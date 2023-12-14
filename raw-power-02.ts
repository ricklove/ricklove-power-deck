import { AppState, ScopeStackValueKind, ScopeStackValueType, StopError } from './src/_appState'
import { appOptimized } from './src/optimizer'
import { createRandomGenerator } from './src/_random'
import { allOperationsList } from './src/_operations/allOperations'
import { CustomDataL } from 'src/models/CustomData'
import { AppStateWithCache } from './src/_operations/_frame'
import { AppStateWithCacheDirectories, cacheImageBuilder, cacheMaskBuilder } from './src/_cache'

export type AppJobState = AppStateWithCache &
    AppStateWithCacheDirectories & {
        jobState: JobState
    }
type JobState = {
    formHash: string
    isFirstRun: boolean
    isDone: boolean
    nextJobIndex: number
    jobs: {
        status: 'created' | 'started' | 'finished'
    }[]
}
type CacheStatus = {
    cache: {
        dependencyKey: string
        cacheFrameId: number
        status: 'cached'
        valueKeys: {
            frame: {
                entries: CacheEntry[]
            }
            scopeStack: {
                entries: CacheEntry[]
            }[]
        }
    }[]
}
type CacheEntry = {
    key: string
    kind: ScopeStackValueKind
}
appOptimized({
    ui: (form) => ({
        size: form.size({}),
        operations: allOperationsList.ui(form),
    }),
    run: async (runtime, form) => {
        const formHash = `${createRandomGenerator(JSON.stringify(form)).randomInt()}`

        const jobStateStore = runtime.getStore_orCreateIfMissing<JobState>(`jobState:${formHash}`, () => ({
            formHash,
            isFirstRun: true,
            isDone: false,
            nextJobIndex: 0,
            jobs: [],
        }))
        const cacheStatusStore = runtime.getStore_orCreateIfMissing<CacheStatus>(`cacheStatus`, () => ({
            cache: [],
        }))
        const cacheStatus = cacheStatusStore.get()

        const graph = runtime.nodes
        const state: AppJobState = {
            runtime: runtime,
            graph,
            scopeStack: [{}],
            workingDirectory: `../input/working`,
            comfyUiInputRelativePath: `../comfyui/ComfyUI/input`,
            jobState: jobStateStore.get(),
            cacheState: {
                exists: (dependencyKey, cacheFrameId) => {
                    const cacheResult = cacheStatus.cache.find(
                        (x) => x.dependencyKey === dependencyKey && x.cacheFrameId === cacheFrameId,
                    )
                    return cacheResult?.status === `cached`
                },
                get: (dependencyKey, cacheFrameId) => {
                    const cacheResult = cacheStatus.cache.find(
                        (x) => x.dependencyKey === dependencyKey && x.cacheFrameId === cacheFrameId,
                    )
                    if (!cacheResult) {
                        return undefined
                    }

                    const getCachedObject = (sourceName: string, entries: CacheEntry[]) => {
                        return Object.fromEntries(
                            entries.map((x) => {
                                const cacheBuilerResult =
                                    x.kind === `mask`
                                        ? cacheMaskBuilder(state, `${sourceName}_${x.key}`, [], {
                                              dependencyKey,
                                          }).loadCached()
                                        : cacheImageBuilder(state, `${sourceName}_${x.key}`, [], {
                                              dependencyKey,
                                          }).loadCached()
                                const nodeOutput = cacheBuilerResult.getOutput()
                                cacheBuilerResult.modify(cacheFrameId)
                                return [x.key, { value: nodeOutput, kind: x.kind }]
                            }),
                        )
                    }

                    const frame01 = getCachedObject(`frame`, cacheResult.valueKeys.frame.entries)
                    const frame = {
                        image: frame01[`image`].value as _IMAGE,
                        mask: frame01[`mask`].value as _MASK,
                    }
                    const scopeStack = cacheResult.valueKeys.scopeStack.map((s, i) =>
                        getCachedObject(`scopeStack${i.toString().padStart(2, `0`)}`, s.entries),
                    )
                    return { frame, scopeStack }
                },
                set: (dependencyKey, cacheFrameId, data) => {
                    const setCachedObject = (
                        sourceName: string,
                        data: Record<string, undefined | { value: _IMAGE | _MASK; kind: ScopeStackValueKind }>,
                    ) => {
                        return Object.fromEntries(
                            Object.entries(data)
                                .map(([k, v]) => {
                                    if (!v) {
                                        return [k, undefined]
                                    }

                                    const cacheBuilerResult =
                                        v.kind === `mask`
                                            ? cacheMaskBuilder(state, `${sourceName}_${k}`, [], {
                                                  dependencyKey,
                                              }).createCache(() => v.value as _MASK)
                                            : cacheImageBuilder(state, `${sourceName}_${k}`, [], {
                                                  dependencyKey,
                                              }).createCache(() => v.value as _IMAGE)
                                    if (!cacheBuilerResult) {
                                        throw new Error(`cache failed to be created`)
                                    }

                                    const nodeOutput = cacheBuilerResult.getOutput()
                                    cacheBuilerResult.modify(cacheFrameId)
                                    return [k, nodeOutput]
                                })
                                .filter((k, v) => !!v),
                        )
                    }

                    const frame = setCachedObject(`frame`, {
                        image: { value: data.frame.image, kind: `image` },
                        mask: { value: data.frame.mask, kind: `mask` },
                    })
                    const scopeStack = data.scopeStack.map((s, i) =>
                        setCachedObject(`scopeStack${i.toString().padStart(2, `0`)}`, s),
                    )

                    return { frame, scopeStack }
                },
            },
        }

        const jobState = state.jobState
        if (jobState.isFirstRun) {
            jobState.isFirstRun = false

            try {
                const queueSize = 2
                for (let i = 0; !jobState.isDone; i++) {
                    const iJob = i
                    runtime.output_text({ title: `#${iJob} created`, message: `#${iJob} created` })
                    jobState.nextJobIndex = i
                    jobState.jobs[iJob] = {
                        status: `created`,
                    }
                    runtime.st.currentDraft?.start()

                    await new Promise<void>((resolve, reject) => {
                        const intervalId = setInterval(() => {
                            if (jobState.jobs[iJob].status === `created`) {
                                return
                            }

                            const jobsDoneCount = jobState.jobs.filter((x) => x.status === `finished`).length
                            const jobsPendingCount = iJob - jobsDoneCount

                            if (jobsPendingCount < queueSize) {
                                clearInterval(intervalId)
                                resolve()
                            }
                        }, 100)
                    })

                    // temp
                    if (i > 10) {
                        jobState.isDone = true
                    }
                }
            } catch (err) {
                console.error(`jobState.isFirstRun`, err)
            }

            return
        }

        const iJob = state.jobState.nextJobIndex
        jobState.jobs[iJob].status = `started`
        try {
            runtime.output_text({
                title: `# ${iJob}`,
                message: `# ${iJob}`,
            })

            const size = form.size
            const initialImage = graph.EmptyImage({
                width: size.width,
                height: size.height,
                color: iJob,
            })
            const initialMask = graph.SolidMask({
                width: size.width,
                height: size.height,
                value: 1,
            })
            allOperationsList.run(state, form.operations, {
                image: initialImage,
                mask: initialMask,
                // TODO: enable cache
                cacheCount_current: 0,
                cacheCount_stop: 10000,
                cacheFrameId: 0,
            })

            graph.PreviewImage({
                images: runtime.AUTO,
            })
            await runtime.PROMPT()
        } catch (err) {
            if (!(err instanceof StopError)) {
                return
            }

            const graph = state.graph
            graph.PreviewImage({
                images: runtime.AUTO,
            })
            await runtime.PROMPT()
        } finally {
            jobState.jobs[iJob].status = `finished`
        }
    },
})
