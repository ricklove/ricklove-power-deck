import { getNextActiveNodeIndex, loadFromScope, loadFromScopeWithExtras, setNodesDisabled, storeInScope } from '../_appState'
import { createFrameOperation, createFrameOperationsGroupList } from './_frame'
import { getCacheFilePattern } from './files'

const faceSwap = createFrameOperation({
    ui: (form) => ({
        faceImageVariable: form.string({}),
    }),
    run: (state, form, { image }) => {
        const { graph } = state

        const faceImage = loadFromScope<_IMAGE>(state, form.faceImageVariable) ?? image

        const faceSwap = graph.ReActorFaceSwap({
            input_image: image,
            swap_model: `inswapper_128.onnx`,
            facedetection: `retinaface_resnet50`,
            face_restore_model: `codeformer.pth`,
            source_image: faceImage,
        })

        let resultImage = faceSwap.outputs.IMAGE

        return { image: resultImage }
    },
})

export const faceOperations = {
    faceSwap,
}
export const faceOperationsList = createFrameOperationsGroupList(faceOperations)
