import { StopError, loadFromScope, storeInScope } from '../_appState'
import { createFrameOperation, createFrameOperationsGroupList } from './_frame'

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
    }),
    run: ({ runtime, graph }, form, { image, mask }) => {
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

        // const blackImage = graph.EmptyImage({
        //     color: 0,
        //     width: startImageSize.outputs.INT,
        //     height: startImageSize.outputs.INT_1,
        //     batch_size: 1,
        // })
        // const whiteImage = graph.EmptyImage({
        //     color: 0xffffff,
        //     width: startImageSize.outputs.INT,
        //     height: startImageSize.outputs.INT_1,
        //     batch_size: 1,
        // })
        // const cropAreaImage = graph.Image_Paste_Crop_by_Location({
        //     image: blackImage,
        //     crop_image: whiteImage,
        //     crop_blending: 0,
        //     left: left_source,
        //     right: right_source,
        //     top: top_source,
        //     bottom: bottom_source,
        // }).outputs.IMAGE

        return { image: croppedImage, mask: croppedMask }
    },
})

export const resizingOperations = {
    cropResizeByMask,
}
export const resizingOperationsList = createFrameOperationsGroupList(resizingOperations)
