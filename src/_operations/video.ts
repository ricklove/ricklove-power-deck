import { PreviewStopError, loadFromScope, storeInScope } from '../_appState'
import { createFrameOperation, createFrameOperationsGroupList } from './_frame'

const filmInterpolation = createFrameOperation({
    ui: (form) => ({
        generate: form.inlineRun({ kind: `special`, text: `Interpolate!!!` }),
        batchSize: form.int({ default: 3 }),
        batchOverlap: form.int({ default: 0 }),
        interpolate: form.int({ default: 1 }),
        inputPath: form.string({ default: `../input/working/input/#####.png` }),
        outputPath: form.string({ default: `../input/working/output/#####.png` }),
    }),
    run: ({ graph }, form, { image, frameIdProvider }) => {
        if (form.generate) {
            const loadImageBatchNode = graph.RL$_LoadImageSequence({
                current_frame: 0,
                count: 1,
                select_every_nth: 1,
                path: form.inputPath,
            })
            const filmNode = graph.Film_Interpolation_$1mtb$2({
                film_model: graph.Load_Film_Model_$1mtb$2({
                    film_model: `Style`,
                }),
                images: loadImageBatchNode,
                interpolate: 1,
            })
            const saveImageBatchNode = graph.RL$_SaveImageSequence({
                images: filmNode,
                current_frame: 0,
                count: 1,
                select_every_nth: 1,
                path: form.inputPath,
            })

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

                loadImageBatchNode.disabled = !batch.isActive
                filmNode.disabled = !batch.isActive
                saveImageBatchNode.disabled = !batch.isActive

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
    filmInterpolation,
}
export const videoOperationsList = createFrameOperationsGroupList(videoOperations)
