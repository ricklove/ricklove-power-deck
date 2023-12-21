import { getNextActiveNodeIndex, loadFromScope, loadFromScopeWithExtras, setNodesDisabled, storeInScope } from '../_appState'
import { createFrameOperation, createFrameOperationsGroupList } from './_frame'
import { getCacheFilePattern } from './_frame'

const output3d = createFrameOperation({
    options: {
        hideLoadVariables: true,
    },
    ui: (form) => ({
        // frameIndex: form.int({ default: 0 }),
        imageVariable: form.string({ default: `a` }),
        depthImageVariable: form.string({ default: `a` }),
        normalImageVariable: form.string({ default: `a` }),

        // imageFilePrefix: form.string({ default: `a` }),
        // depthFilePrefix: form.string({ default: `a` }),
        // normalFilePrefix: form.string({ default: `a` }),
    }),
    run: (state, form, { image, afterFramePrompt }) => {
        const { graph } = state

        const saveImage = (imageVariable: string, saveName: string) => {
            const resizedImage = graph.ImageTransformResizeRelative({
                images: loadFromScope(state, imageVariable) ?? image,
                method: `lanczos`,
                scale_width: 1,
                scale_height: 1,
            }).outputs.IMAGE
            graph.SaveImage({ images: resizedImage, filename_prefix: saveName })
            graph.PreviewImage({ images: resizedImage })
            return resizedImage
        }

        saveImage(form.imageVariable, `image`)
        saveImage(form.depthImageVariable, `depth`)
        saveImage(form.normalImageVariable, `normal`)

        afterFramePrompt.push(() => {
            state.runtime.output_3dImage({
                image: `image`,
                depth: `depth`,
                normal: `normal`,
            })
        })

        return { image }
    },
})

const outputVideo = createFrameOperation({
    options: {
        hideLoadVariables: true,
        hideStoreVariables: true,
    },
    ui: (form) => ({
        imageVariable: form.string({ default: `a` }),
    }),
    run: (state, form, { image, workingDirectory, frameIdProvider }) => {
        const { graph, runtime } = state

        const iNodeStart = getNextActiveNodeIndex(runtime)

        const loadImageBatchNode = graph.RL$_LoadImageSequence({
            path: getCacheFilePattern(
                workingDirectory,
                form.imageVariable,
                loadFromScopeWithExtras(state, form.imageVariable)?.cacheIndex ?? 0,
            ),
            count: 1,
            current_frame: 0,
            select_every_nth: 1,
        })
        graph.VHS$_VideoCombine({
            images: loadImageBatchNode.outputs.image,
            format: `video/h264-mp4`,
        })

        const iNodeAfterEnd = getNextActiveNodeIndex(runtime)

        // output in case it is disabled to prevent error message
        const backupOutputNode = graph.PreviewImage({
            images: image,
        })

        frameIdProvider.subscribe((_) => {
            const batch = frameIdProvider.getBatch(frameIdProvider._state.frameIds.length, 0)
            loadImageBatchNode.inputs.current_frame = batch.startFrameId
            loadImageBatchNode.inputs.count = batch.count
            loadImageBatchNode.inputs.select_every_nth = batch.selectEveryNth

            setNodesDisabled(runtime, !batch.isActive, iNodeStart, iNodeAfterEnd - iNodeStart)

            // ensure there is output on disabled frames
            backupOutputNode.disabled = batch.isActive
        })

        return {}
    },
})

export const outputOperations = {
    output3d,
    outputVideo,
}
export const outputOperationsList = createFrameOperationsGroupList(outputOperations)
