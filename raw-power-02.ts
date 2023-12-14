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
        // just for info
        cacheStepIndex: number
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
        clearCache: form.inlineRun({
            kind: `warning`,
            text: `Clear Cache!!!`,
        }),
        imageSource: form.group({
            items: () => ({
                directory: form.string({ default: `video` }),
                filePattern: form.string({ default: `#####.png` }),
                // pattern: form.string({ default: `*.png` }),
                startIndex: form.int({ default: 1, min: 0 }),
                endIndex: form.intOpt({ default: 10000, min: 0, max: 10000 }),
                selectEveryNth: form.intOpt({ default: 1, min: 1 }),
                // batchSize: form.int({ default: 1, min: 1 }),
                iterationCount: form.int({ default: 1, min: 1 }),
                // iterationSize: form.intOpt({ default: 1, min: 1 }),
                preview: form.inlineRun({}),
            }),
        }),
        // size: form.size({}),
        operations: allOperationsList.ui(form),
    }),
    run: async (runtime, form) => {
        const jobStateStore = runtime.getStore_orCreateIfMissing(`jobState`, () => ({
            isCancelled: false,
        }))
        const jobState = jobStateStore.get()
        if (form.cancel) {
            jobState.isCancelled = true
            return
        }

        const cacheStatusStore = runtime.getStore_orCreateIfMissing<CacheStatus>(`cacheStatus`, () => ({
            cache: [],
        }))
        const cacheStatus = cacheStatusStore.get()
        console.log(`cacheStatus`, { cacheStatus: JSON.stringify(cacheStatus) })

        if (form.clearCache) {
            cacheStatus.cache = []
            return
        }

        const graph = runtime.nodes
        const state: AppState = {
            runtime: runtime,
            graph,
            scopeStack: [{}],
            workingDirectory: `../input/working`,
            comfyUiInputRelativePath: `../comfyui/ComfyUI/input`,
            cacheState: {
                exists: (cacheStepIndex, dependencyKey, cacheFrameId) => {
                    console.log(`cacheState: exists`, {
                        cacheStepIndex,
                        dependencyKey,
                        cacheFrameId,
                        cacheStatus: JSON.parse(JSON.stringify(cacheStatus)),
                    })

                    const cacheResult = cacheStatus.cache.find(
                        (x) => x.dependencyKey === dependencyKey && x.cacheFrameId === cacheFrameId,
                    )
                    return cacheResult?.status === `cached`
                },
                get: (cacheStepIndex, dependencyKey, cacheFrameId) => {
                    console.log(`cacheState: get`, {
                        cacheStepIndex,
                        dependencyKey,
                        cacheFrameId,
                        cacheStatus: JSON.parse(JSON.stringify(cacheStatus)),
                    })

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
                                        ? cacheMaskBuilder(
                                              state,
                                              `${cacheStepIndex.toString().padStart(4, `0`)}_${sourceName}_${x.key}`,
                                              [],
                                              {
                                                  dependencyKey,
                                              },
                                          ).loadCached()
                                        : cacheImageBuilder(
                                              state,
                                              `${cacheStepIndex.toString().padStart(4, `0`)}_${sourceName}_${x.key}`,
                                              [],
                                              {
                                                  dependencyKey,
                                              },
                                          ).loadCached()
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
                set: (cacheStepIndex, dependencyKey, cacheFrameId, data) => {
                    console.log(`cacheState: set`, {
                        cacheStepIndex,
                        dependencyKey,
                        cacheFrameId,
                        data,
                        cacheStatus: JSON.parse(JSON.stringify(cacheStatus)),
                    })

                    const setCachedObject = (
                        sourceName: string,
                        data: Record<string, undefined | { value: _IMAGE | _MASK; kind: ScopeStackValueKind }>,
                    ) => {
                        const result = Object.fromEntries(
                            Object.entries(data)
                                .map(([k, v]) => {
                                    if (!v) {
                                        return [k, undefined]
                                    }

                                    const cacheBuilerResult =
                                        v.kind === `mask`
                                            ? cacheMaskBuilder(
                                                  state,
                                                  `${cacheStepIndex.toString().padStart(4, `0`)}_${sourceName}_${k}`,
                                                  [],
                                                  {
                                                      dependencyKey,
                                                  },
                                              ).createCache(() => v.value as _MASK)
                                            : cacheImageBuilder(
                                                  state,
                                                  `${cacheStepIndex.toString().padStart(4, `0`)}_${sourceName}_${k}`,
                                                  [],
                                                  {
                                                      dependencyKey,
                                                  },
                                              ).createCache(() => v.value as _IMAGE)
                                    if (!cacheBuilerResult) {
                                        throw new Error(`cache failed to be created`)
                                    }

                                    const nodeOutput = cacheBuilerResult.getOutput()
                                    cacheBuilerResult.modify(cacheFrameId)
                                    return [k, nodeOutput]
                                })
                                .filter((k, v) => !!v),
                        )

                        return result
                    }

                    const frame = setCachedObject(`frame`, {
                        image: { value: data.frame.image, kind: `image` },
                        mask: { value: data.frame.mask, kind: `mask` },
                    })
                    const scopeStack = data.scopeStack.map((s, i) =>
                        setCachedObject(`scopeStack${i.toString().padStart(2, `0`)}`, s),
                    )

                    // Planned to cache, though this could fail... hmm
                    const valueKeys = {
                        frame: {
                            entries: [
                                {
                                    key: `image`,
                                    kind: `image` as const,
                                },
                                {
                                    key: `mask`,
                                    kind: `mask` as const,
                                },
                            ],
                        },
                        scopeStack: data.scopeStack.map((s, i) => ({
                            entries: Object.entries(s)
                                .filter(([k, v]) => !!v)
                                .map(([k, v]) => {
                                    return {
                                        key: k,
                                        kind: v!.kind,
                                    }
                                }),
                        })),
                    }
                    const cacheValue = JSON.parse(
                        JSON.stringify({
                            cacheStepIndex,
                            dependencyKey,
                            cacheFrameId,
                            status: `cached`,
                            valueKeys,
                        }),
                    )
                    const onCacheCreated = () => cacheStatus.cache.push(cacheValue)
                    return { frame, scopeStack, onCacheCreated }
                },
            },
        }

        const runNext = () => {
            setTimeout(() => {
                if (jobState.isCancelled) {
                    jobState.isCancelled = false
                    return
                }
                runtime.st.currentDraft?.start()
            }, 10)
        }

        try {
            runtime.output_text({
                title: `START`,
                message: `START

${JSON.stringify(
    {
        cacheStatus,
    },
    null,
    2,
)}`,
            })

            const frameIds = [...new Array(form.imageSource.iterationCount)].map(
                (_, i) => form.imageSource.startIndex + i * (form.imageSource.selectEveryNth ?? 1),
            )
            const imageDir = form.imageSource.directory.replace(/\/$/g, ``)
            const loadImageNode = graph.RL$_LoadImageSequence({
                path: `${imageDir}/${form.imageSource.filePattern}`,
                current_frame: frameIds[0],
            })
            const initialImage = loadImageNode.outputs.image

            const { INT: width, INT_1: height } = graph.Get_Image_Size({
                image: initialImage,
            }).outputs
            // const initialImage = graph.EmptyImage({
            //     width: size.width,
            //     height: size.height,
            //     color: iJob,
            // })
            const initialMask = graph.SolidMask({
                width: width,
                height: height,
                value: 1,
            })

            let cacheCount_stop = 0
            while (true) {
                cacheCount_stop++

                let wasCacheStopped = false

                // Loop through all frames in a single job
                for (const frameId of frameIds) {
                    loadImageNode.inputs.current_frame = frameId
                    if (form.imageSource.preview) {
                        throw new PreviewStopError(() => {})
                    }

                    try {
                        allOperationsList.run(state, form.operations, {
                            image: initialImage,
                            mask: initialMask,
                            cacheStepIndex_current: 0,
                            cacheStepIndex_stop: cacheCount_stop,
                            cacheFrameId: frameId,
                        })

                        // It finished without any caching, so just keep going
                        continue

                        // // only if no cache was created - actually done with all steps for this frame
                        // graph.PreviewImage({
                        //     images: runtime.AUTO,
                        // })
                        // await runtime.PROMPT()

                        // if (frameIds[frameIds.length - 1] !== frameId) {
                        //     return runNext()
                        // }
                    } catch (err) {
                        if (!(err instanceof CacheStopError)) {
                            throw err
                        }

                        wasCacheStopped = true

                        if (err.wasAlreadyCached) {
                            console.log(`CACHE wasAlreadyCached`, { frameId, cacheCount_stop })
                            continue
                        }

                        graph.PreviewImage({
                            images: runtime.AUTO,
                        })
                        await runtime.PROMPT()

                        // callback to save cache status
                        err.onCacheCreated()

                        console.log(`CACHE created`, { frameId, cacheCount_stop })
                        return runNext()
                    }
                }

                if (!wasCacheStopped) {
                    // done
                    return
                }
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
            runtime.output_text({
                title: `DONE`,
                message: `DONE

${JSON.stringify(
    {
        cacheStatus,
    },
    null,
    2,
)}`,
            })
        }
    },
})
