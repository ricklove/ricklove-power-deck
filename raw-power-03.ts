import { PreviewStopError, AppState } from './src/_appState'
import { appOptimized } from './src/optimizer'
import { allOperationsList } from './src/_operations/allOperations'
import { CacheState, calculateDependencyKey, createFrameIdProvider } from './src/_operations/_frame'

appOptimized({
    ui: (form) => ({
        cancel: form.inlineRun({
            kind: `warning`,
            text: `Cancel!`,
        }),
        // loadFormJson: form.str({
        //     textarea: true,
        // }),
        // loadForm: form.inlineRun({
        //     kind: `warning`,
        //     text: `Load Form!`,
        // }),
        imageSource: form.group({
            items: () => ({
                directory: form.string({ default: `../input/video` }),
                workingDirectory: form.string({ default: `../input/video/working` }),
                filePattern: form.string({ default: `#####.png` }),
                // pattern: form.string({ default: `*.png` }),
                startIndex: form.int({ default: 1, min: 0 }),
                endIndex: form.intOpt({ default: 10000, min: 0, max: 10000 }),
                selectEveryNth: form.intOpt({ default: 1, min: 1 }),
                repeatCount: form.intOpt({ default: 1, min: 1 }),
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
        console.log(`formSerial`, { formSerial: JSON.stringify(runtime.formSerial) })
        console.log(`formResult`, { formResultJson: JSON.stringify(runtime.formResult) })

        // if (form.loadForm) {
        //     const formSerial = JSON.parse(form.loadFormJson) as typeof runtime.formSerial
        //     console.log(`loadForm`, { formSerial })

        //     const currentDraft = runtime.st.currentDraft!
        //     currentDraft.data.appParams = formSerial
        //     currentDraft.isInitialized = false
        //     currentDraft.isInitializing = false
        //     currentDraft.AWAKE()
        //     return
        // }

        const jobStateStore = runtime.Store.getOrCreate({
            key: `jobState`,
            makeDefaultValue: () => ({
                isCancelled: false,
            }),
        })
        const jobState = jobStateStore.get()
        if (form.cancel) {
            jobState.isCancelled = true
            return
        }

        const state: AppState = {
            graph: runtime.nodes,
            runtime,
            scopeStack: [{}],
        }
        const graph = state.graph
        const frameIdProvider = createFrameIdProvider(form.imageSource)

        const imageDir = form.imageSource.directory.replace(/\/$/g, ``)
        const loadImageNode = graph.RL$_LoadImageSequence({
            path: `${imageDir}/${form.imageSource.filePattern}`,
            current_frame: frameIdProvider.get().frameId,
        })
        frameIdProvider.subscribe((v) => {
            console.log(`frameIdProvider.subscribe - changing loadImageNode.inputs.current_frame`, {
                current_frame: loadImageNode.inputs.current_frame,
                v,
            })
            loadImageNode.inputs.current_frame = v
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

        if (form.imageSource.preview) {
            graph.PreviewImage({
                images: runtime.AUTO,
            })
            for (const frameId of frameIdProvider) {
                await runtime.PROMPT()
                if (form.cancel) {
                    jobState.isCancelled = true
                    return
                }
            }
            return
        }

        let cacheIndex_run = 0
        while (cacheIndex_run < 1000) {
            state.runtime.output_text({
                title: `cacheIndex_run`,
                message: `@[${cacheIndex_run}] START`,
            })

            try {
                const cache: CacheState = {
                    cacheIndex: 0,
                    cacheIndex_run,
                    dependencyKey: 42,
                }
                const result = allOperationsList.run(state, form.operations, {
                    image: initialImage,
                    mask: initialMask,
                    cache: { ...cache, dependencyKey: calculateDependencyKey(cache, form.imageSource) },
                    frameIdProvider,
                    workingDirectory: form.imageSource.workingDirectory,
                    afterFramePrompt: [],
                })
                state.graph.PreviewImage({ images: result.image })

                for (const frameId of frameIdProvider) {
                    await runtime.PROMPT()

                    if (form.cancel) {
                        jobState.isCancelled = true
                        return
                    }

                    result.afterFramePrompt.forEach((x) => {
                        try {
                            x()
                        } catch (err) {
                            console.error(`ERROR afterFramePrompt`, { err })
                        }
                    })
                }

                // reached the end - so done
                return
            } catch (err) {
                if (!(err instanceof PreviewStopError)) {
                    throw err
                }

                state.runtime.output_text({
                    title: `stale cache!`,
                    message: `[${err.options?.cacheIndex}] @[${err.options?.cacheIndex_run}] ${
                        err.options?.cachedAlready ? `Already cached` : `Running!`
                    }`,
                })

                if (!err.options?.cachedAlready) {
                    // const graph = state.graph
                    // graph.PreviewImage({
                    //     images: runtime.AUTO,
                    // })
                    let i = 0
                    for (const frameId of frameIdProvider) {
                        await runtime.PROMPT()

                        if (form.cancel) {
                            jobState.isCancelled = true
                            return
                        }

                        err.options?.afterFramePrompt?.forEach((x) => {
                            try {
                                x()
                            } catch (err) {
                                console.error(`ERROR afterFramePrompt`, { err })
                            }
                        })

                        i++
                        if (err.options?.previewCount && err.options.previewCount > i) {
                            break
                        }
                    }
                    // await runtime.PROMPT()
                }

                if (err.options?.cacheIndex == undefined || !err.options.isAutoCache) {
                    return
                }
            }

            cacheIndex_run++
        }
    },
})
