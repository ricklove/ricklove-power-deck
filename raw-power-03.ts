import { PreviewStopError, AppState } from './src/_appState'
import { appOptimized } from './src/optimizer'
import { allOperationsList } from './src/_operations/allOperations'
import { createFrameIdProvider } from './src/_operations/_frame'

appOptimized({
    ui: (form) => ({
        cancel: form.inlineRun({
            kind: `warning`,
            text: `Cancel!`,
        }),
        imageSource: form.group({
            items: () => ({
                directory: form.string({ default: `../input/video` }),
                workingDirectory: form.string({ default: `../input/video/working` }),
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
        console.log(`formSerial`, { formSerial: runtime.formSerial })

        const jobStateStore = runtime.getStore_orCreateIfMissing(`jobState`, () => ({
            isCancelled: false,
        }))
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
        frameIdProvider.subscribe((v) => (loadImageNode.inputs.current_frame = v))
        const initialImage = loadImageNode.outputs.image

        try {
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
                }
                return
            }

            const result = allOperationsList.run(state, form.operations, {
                image: initialImage,
                mask: initialMask,
                cache: { cacheIndex: 0, dependencyKey: 42 },
                frameIdProvider,
                workingDirectory: form.imageSource.workingDirectory,
                afterFramePrompt: [],
            })

            for (const frameId of frameIdProvider) {
                await runtime.PROMPT()
                result.afterFramePrompt.forEach((x) => {
                    try {
                        x()
                    } catch (err) {
                        console.error(`ERROR afterFramePrompt`, { err })
                    }
                })
            }
        } catch (err) {
            if (!(err instanceof PreviewStopError)) {
                throw err
            }

            // const graph = state.graph
            // graph.PreviewImage({
            //     images: runtime.AUTO,
            // })
            for (const frameId of frameIdProvider) {
                await runtime.PROMPT()

                err.afterFramePrompt?.forEach((x) => {
                    try {
                        x()
                    } catch (err) {
                        console.error(`ERROR afterFramePrompt`, { err })
                    }
                })
            }
            // await runtime.PROMPT()
        }
    },
})
