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

        try {
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

            // Loop through all frames in a single job
            for (const frameId of frameIds) {
                loadImageNode.inputs.current_frame = frameId
                if (form.imageSource.preview) {
                    throw new PreviewStopError(() => {})
                }

                allOperationsList.run(state, form.operations, {
                    image: initialImage,
                    mask: initialMask,
                })

                // only if no cache was created - actually done with all steps for this frame
                graph.PreviewImage({
                    images: runtime.AUTO,
                })
                await runtime.PROMPT()
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
        }
    },
})
