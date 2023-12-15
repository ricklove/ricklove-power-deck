import { PreviewStopError, AppState } from './src/_appState'
import { appOptimized } from './src/optimizer'
import { allOperationsList } from './src/_operations/allOperations'

appOptimized({
    ui: (form) => ({
        cancel: form.inlineRun({
            kind: `warning`,
            text: `Cancel!`,
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

        const state: AppState = {
            graph: runtime.nodes,
            runtime,
            scopeStack: [{}],
        }
        const graph = state.graph
        const frameIds = [...new Array(form.imageSource.iterationCount)].map(
            (_, i) => form.imageSource.startIndex + i * (form.imageSource.selectEveryNth ?? 1),
        )
        const frameIdProvider = {
            state: 0,
            get: () => {
                console.log(`frameIdProvider.get`, { frameIdProvider, frameIds })
                return frameIdProvider.state
            },
        }

        const imageDir = form.imageSource.directory.replace(/\/$/g, ``)
        const loadImageNode = graph.RL$_LoadImageSequence({
            path: `${imageDir}/${form.imageSource.filePattern}`,
            current_frame: frameIds[0],
        })
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
                for (const frameId of frameIds) {
                    frameIdProvider.state = frameId
                    loadImageNode.inputs.current_frame = frameId
                    await runtime.PROMPT()
                }
                return
            }

            allOperationsList.run(state, form.operations, {
                image: initialImage,
                mask: initialMask,
                frameId: frameIdProvider.get,
            })

            for (const frameId of frameIds) {
                frameIdProvider.state = frameId
                loadImageNode.inputs.current_frame = frameId
                await runtime.PROMPT()
            }
        } catch (err) {
            if (!(err instanceof PreviewStopError)) {
                throw err
            }

            // const graph = state.graph
            // graph.PreviewImage({
            //     images: runtime.AUTO,
            // })
            for (const frameId of frameIds) {
                frameIdProvider.state = frameId
                loadImageNode.inputs.current_frame = frameId
                await runtime.PROMPT()
            }
            // await runtime.PROMPT()
        }
    },
})
