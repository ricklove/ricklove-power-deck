import { PreviewStopError, loadFromScope, storeInScope } from '../_appState'
import { createFrameOperation, createFrameOperationsGroupList } from './_frame'
import { imageOperations } from './image'
import { maskOperations } from './mask'
import { storageOperations } from './storage'

const cropResizeByMask = createFrameOperation({
    ui: (form) => ({
        padding: form.int({ default: 0 }),
        size: form.choice({
            items: () => ({
                maxSideLength: form.intOpt({ default: 1024 }),
                target: form.group({
                    items: () => ({
                        width: form.intOpt({ default: 1024 }),
                        height: form.floatOpt({ default: 1024 }),
                    }),
                }),
            }),
        }),
        storeVariables: form.groupOpt({
            items: () => ({
                startImage: form.strOpt({ default: `beforeCropImage` }),
                startMask: form.strOpt({ default: `beforeCropMask` }),
                cropAreaMask: form.strOpt({ default: `cropArea` }),
                endImage: form.strOpt({ default: `afterCropImage` }),
                endMask: form.strOpt({ default: `afterCropMask` }),
            }),
        }),
    }),
    run: (state, form, frame) => {
        const { runtime, graph } = state
        const { image, mask } = frame
        const startImage = image
        const cropMask = mask

        const {
            cropped_image: croppedImage,
            cropped_mask: croppedMask,
            left_source,
            right_source,
            top_source,
            bottom_source,
        } = graph.RL$_Crop$_Resize({
            image: startImage,
            mask: cropMask,
            padding: form.padding,
            max_side_length: form.size.maxSideLength ?? undefined,
            width: form.size.target?.width ?? undefined,
            height: form.size.target?.height ?? undefined,
        }).outputs

        const startImageSize = graph.Get_Image_Size({
            image: startImage,
        })

        const blackImage = graph.EmptyImage({
            color: 0,
            width: startImageSize.outputs.INT,
            height: startImageSize.outputs.INT_1,
            batch_size: 1,
        })
        const whiteImage = graph.EmptyImage({
            color: 0xffffff,
            width: startImageSize.outputs.INT,
            height: startImageSize.outputs.INT_1,
            batch_size: 1,
        })
        const cropAreaImage = graph.Image_Paste_Crop_by_Location({
            image: blackImage,
            crop_image: whiteImage,
            crop_blending: 0,
            left: left_source,
            right: right_source,
            top: top_source,
            bottom: bottom_source,
        }).outputs.IMAGE

        const cropAreaMask = graph.Image_To_Mask({
            image: cropAreaImage,
            method: `intensity`,
        })

        if (form.storeVariables?.startImage) {
            storageOperations.storeImageVarible.run(state, { name: form.storeVariables.startImage }, { ...frame, image })
        }
        if (form.storeVariables?.endImage) {
            storageOperations.storeImageVarible.run(
                state,
                { name: form.storeVariables.endImage },
                { ...frame, image: croppedImage },
            )
        }
        if (form.storeVariables?.startMask) {
            storageOperations.storeMaskVariable.run(state, { name: form.storeVariables.startMask }, { ...frame, mask })
        }
        if (form.storeVariables?.endMask) {
            storageOperations.storeMaskVariable.run(state, { name: form.storeVariables.endMask }, { ...frame, mask: croppedMask })
        }
        if (form.storeVariables?.cropAreaMask) {
            storageOperations.storeMaskVariable.run(
                state,
                { name: form.storeVariables.cropAreaMask },
                { ...frame, mask: cropAreaMask },
            )
        }

        return { image: croppedImage, mask: croppedMask }
    },
})

export const resizingOperations = {
    cropResizeByMask,
}
export const resizingOperationsList = createFrameOperationsGroupList(resizingOperations)
