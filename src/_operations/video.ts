import { PreviewStopError, getNextActiveNodeIndex, loadFromScope, setNodesDisabled, storeInScope } from '../_appState'
import { createFrameOperation, createFrameOperationsGroupList } from './_frame'

const filmInterpolationDoubleBack = createFrameOperation({
    ui: (form) => ({
        generate: form.inlineRun({ kind: `special`, text: `Interpolate!!!` }),
        batchSize: form.int({ default: 3 }),
        batchOverlap: form.int({ default: 0 }),
        iterations: form.int({ default: 1 }),
        // interpolate: form.int({ default: 1 }),
        inputPath: form.string({ default: `../input/working/input/#####.png` }),
        outputPath: form.string({ default: `../input/working/output/#####.png` }),
    }),
    run: ({ runtime, graph }, form, { image, frameIdProvider }) => {
        if (form.generate) {
            const iNodeStart = getNextActiveNodeIndex(runtime)
            const loadImageBatchNode = graph.RL$_LoadImageSequence({
                current_frame: 0,
                count: 1,
                select_every_nth: 1,
                path: form.inputPath,
            })
            const filmModelNode = graph.Load_Film_Model_$1mtb$2({
                film_model: `Style`,
            })
            let currentImages = loadImageBatchNode.outputs.image

            for (let i = 0; i < form.iterations; i++) {
                const filmFrames = graph.Film_Interpolation_$1mtb$2({
                    film_model: filmModelNode,
                    images: currentImages,
                    interpolate: 1,
                })
                const filmframes_removedFirst = graph.ImageBatchRemove({
                    images: filmFrames,
                    index: 1,
                })
                const middleFrames = graph.VHS$_SelectEveryNthImage({
                    images: filmframes_removedFirst,
                    select_every_nth: 2,
                })
                const middleFrames_withFirst = graph.ImageBatchJoin({
                    images_a: graph.ImageBatchGet({
                        images: filmFrames,
                        index: 1,
                    }),
                    images_b: middleFrames,
                })
                const middleFrames_withFirstAndLast = graph.ImageBatchJoin({
                    images_a: middleFrames_withFirst,
                    images_b: graph.ImageBatchGet({
                        images: filmFrames,
                        index: graph.ImpactImageInfo({
                            value: filmFrames,
                        }).outputs.batch,
                    }),
                })
                const filmFrames2 = graph.Film_Interpolation_$1mtb$2({
                    film_model: filmModelNode,
                    images: middleFrames_withFirstAndLast,
                    interpolate: 1,
                })
                const filmframes2_removedFirst = graph.ImageBatchRemove({
                    images: filmFrames2,
                    index: 1,
                })
                const middleFrames2 = graph.VHS$_SelectEveryNthImage({
                    images: filmframes2_removedFirst,
                    select_every_nth: 2,
                })
                currentImages = middleFrames2.outputs.IMAGE
            }

            const saveImageBatchNode = graph.RL$_SaveImageSequence({
                images: currentImages,
                current_frame: 0,
                count: 1,
                select_every_nth: 1,
                path: form.outputPath,
            })
            const previewCompareNode = graph.ImageBlend({
                image1: loadImageBatchNode.outputs.image,
                image2: currentImages,
                blend_mode: `normal`,
                blend_factor: 0.5,
            })
            const compareNode = graph.PreviewImage({
                images: previewCompareNode,
            })
            const iNodeAfterEnd = getNextActiveNodeIndex(runtime)

            // output in case it is disabled to prevent error message
            const backupOutputNode = graph.PreviewImage({
                images: image,
            })

            frameIdProvider.subscribe((v) => {
                // reconnect frames as needed
                const batch = frameIdProvider.getBatch(form.batchSize, form.batchOverlap)
                console.log(`filmInterpolation: batch`, { batch })

                loadImageBatchNode.inputs.current_frame = batch.startFrameId
                loadImageBatchNode.inputs.count = batch.count
                loadImageBatchNode.inputs.select_every_nth = batch.selectEveryNth
                saveImageBatchNode.inputs.current_frame = batch.startFrameId
                saveImageBatchNode.inputs.count = batch.count
                saveImageBatchNode.inputs.select_every_nth = batch.selectEveryNth

                setNodesDisabled(runtime, !batch.isActive, iNodeStart, iNodeAfterEnd - iNodeStart)

                // ensure there is output on disabled frames
                backupOutputNode.disabled = batch.isActive
            })

            throw new PreviewStopError(undefined)
        }

        const loadCurrentFrameResultNode = graph.RL$_LoadImageSequence({
            current_frame: 0,
            path: form.inputPath,
        })
        const resultImage = loadCurrentFrameResultNode.outputs.image

        frameIdProvider.subscribe((v) => {
            loadCurrentFrameResultNode.inputs.current_frame = v
        })
        return { image: resultImage }
    },
})

export const videoOperations = {
    filmInterpolationDoubleBack,
}
export const videoOperationsList = createFrameOperationsGroupList(videoOperations)
