import { ScopeStackValueKind, ScopeStackValueType, PreviewStopError } from './src/_appState'
import { appOptimized } from './src/optimizer'
import { createRandomGenerator } from './src/_random'
import { allOperationsList } from './src/_operations/allOperations'
import { CustomDataL } from 'src/models/CustomData'
import { AppStateWithCache, CacheStopError } from './src/_operations/_frame'
import { AppStateWithCacheDirectories, cacheImageBuilder, cacheMaskBuilder } from './src/_cache'

export type AppState = AppStateWithCache & AppStateWithCacheDirectories

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
        cancel: form.inlineRun({
            kind: `warning`,
            text: `Cancel!`,
        }),
        size: form.size({}),
        operations: allOperationsList.ui(form),
    }),
    run: async (runtime, form) => {
        const cacheStatusStore = runtime.getStore_orCreateIfMissing<CacheStatus>(`cacheStatus`, () => ({
            cache: [],
        }))
        const cacheStatus = cacheStatusStore.get()
        console.log(`cacheStatus`, { cacheStatus: JSON.stringify(cacheStatus) })

        const graph = runtime.nodes
        const state: AppState = {
            runtime: runtime,
            graph,
            scopeStack: [{}],
            workingDirectory: `../input/working`,
            comfyUiInputRelativePath: `../comfyui/ComfyUI/input`,
            cacheState: {
                exists: (dependencyKey, cacheFrameId) => {
                    console.log(`cacheState: exists`, { dependencyKey, cacheFrameId, cacheStatus: JSON.stringify(cacheStatus) })

                    const cacheResult = cacheStatus.cache.find(
                        (x) => x.dependencyKey === dependencyKey && x.cacheFrameId === cacheFrameId,
                    )
                    return cacheResult?.status === `cached`
                },
                get: (dependencyKey, cacheFrameId) => {
                    console.log(`cacheState: get`, { dependencyKey, cacheFrameId, cacheStatus: JSON.stringify(cacheStatus) })

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
                    console.log(`cacheState: set`, {
                        dependencyKey,
                        cacheFrameId,
                        data,
                        cacheStatus: JSON.stringify(cacheStatus),
                    })

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

        const formHash = `${createRandomGenerator(JSON.stringify({ ...form, cancel: undefined })).randomInt()}`
        const defaultJobState = () => ({
            formHash,
            isFirstRun: true,
            isDone: false,
            isCancelled: false,
            shouldReset: true,
            jobs: [] as { status: 'created' | 'started' | 'finished'; cacheCount_stop?: number; nextCacheCount_stop?: number }[],
        })
        const jobStateStore = runtime.getStore_orCreateIfMissing(`jobState:${formHash}`, defaultJobState)
        const jobState = jobStateStore.get()
        if (form.cancel) {
            jobState.isCancelled = true
            return
        }

        // if (jobState.shouldReset) {
        //     // reset jobState
        //     const d = defaultJobState()
        //     for (const k in jobState) {
        //         const jobStateUntyped = jobState as Record<string, unknown>
        //         jobStateUntyped[k] = d[k as keyof typeof d]
        //     }
        // }

        if (jobState.isCancelled) {
            return
        }

        if (jobState.isFirstRun) {
            jobState.isFirstRun = false

            try {
                // cache checks will fail if queue size > 1
                const queueSize = 1
                for (let iJob = 0; !jobState.isDone && !jobState.isCancelled; iJob++) {
                    runtime.output_text({ title: `#${iJob} created`, message: `#${iJob} created` })
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
                }

                if (jobState.isCancelled) {
                    jobState.shouldReset = true
                }
            } catch (err) {
                console.error(`jobState.isFirstRun`, err)
            }

            return
        }

        const iJob = jobState.jobs.length - 1
        const job = jobState.jobs[iJob]
        job.status = `started`
        try {
            runtime.output_text({
                title: `# ${iJob} START`,
                message: `# ${iJob} START

${JSON.stringify(
    {
        jobState,
        cacheStatus,
    },
    null,
    2,
)}`,
            })

            const cacheCount_stop = (job.cacheCount_stop =
                jobState.jobs[iJob - 1]?.nextCacheCount_stop ?? jobState.jobs[iJob - 1]?.cacheCount_stop ?? 1)

            const frameIds = [0]
            let wasCacheStopped = false

            // Loop through all frames in a single job
            for (const frameId of frameIds) {
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

                try {
                    allOperationsList.run(state, form.operations, {
                        image: initialImage,
                        mask: initialMask,
                        cacheCount_current: 0,
                        cacheCount_stop,
                        cacheFrameId: frameId,
                    })
                } catch (err) {
                    if (!(err instanceof CacheStopError)) {
                        throw err
                    }
                    wasCacheStopped = true
                }

                graph.PreviewImage({
                    images: runtime.AUTO,
                })
                await runtime.PROMPT()
            }

            if (!wasCacheStopped) {
                jobState.isDone = true
            } else {
                job.nextCacheCount_stop = cacheCount_stop + 1
            }
        } catch (err) {
            if (!(err instanceof PreviewStopError)) {
                throw err
            }

            const graph = state.graph
            graph.PreviewImage({
                images: runtime.AUTO,
            })
            await runtime.PROMPT()
        } finally {
            jobState.jobs[iJob].status = `finished`

            runtime.output_text({
                title: `# ${iJob} DONE`,
                message: `# ${iJob} DONE

${JSON.stringify(
    {
        jobState,
        cacheStatus,
    },
    null,
    2,
)}`,
            })
        }
    },
})
