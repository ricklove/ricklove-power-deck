import { loadFromScope, loadFromScopeWithExtras } from '../_appState'
import { createFrameOperation, createFrameOperationsGroupList } from './_frame'
import { getCacheFilePattern } from './files'
import { storageOperations } from './storage'

const cropResizeByMask = createFrameOperation({
    options: {
        hideStoreVariables: true,
    },
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
        interpolate: form.groupOpt({
            items: () => ({
                maskVariableCachedName: form.str({ default: `maskA` }),

                // firstMaskImageFilePath: form.str({ default: `../input/00001.png` }),
                // lastMaskImageFilePath: form.str({ default: `../input/01000.png` }),
                // firstFrameId: form.int({default:0}),
                // lastFrameId: form.int({}),
                // lastMaskVariable: form.str({ default: `maskB` }),
                // useFrameIdIndexRatio: form.bool({ default: true }),
            }),
        }),
        storeVariables: form.groupOpt({
            items: () => ({
                beforeCropImage: form.strOpt({ default: `beforeCropImage` }),
                beforeCropMask: form.strOpt({ default: `beforeCropMask` }),
                cropAreaMask: form.strOpt({ default: `cropAreaMask` }),
                afterCropImage: form.strOpt({ default: `afterCropImage` }),
                afterCropMask: form.strOpt({ default: `afterCropMask` }),
            }),
        }),
    }),
    run: (state, form, frame) => {
        const { runtime, graph } = state
        const { image, mask } = frame
        const startImage = image
        const cropMask = mask
        let interpolate_mask_a = undefined as undefined | _MASK
        let interpolate_mask_b = undefined as undefined | _MASK

        if (form.interpolate) {
            const { maskVariableCachedName } = form.interpolate
            const maskVar = loadFromScopeWithExtras(state, form.interpolate.maskVariableCachedName)

            const loadMaskFromCachedFile = () => {
                const loadMaskImageNode = graph.RL$_LoadImageSequence({
                    path: getCacheFilePattern(frame.workingDirectory, maskVariableCachedName, maskVar?.cacheIndex ?? 0),
                    current_frame: 0,
                })
                const mask = graph.Image_To_Mask({
                    image: loadMaskImageNode.outputs.image,
                    method: `intensity`,
                }).outputs.MASK

                return {
                    mask,
                    loadMaskImageNode,
                }
            }

            const maskA = loadMaskFromCachedFile()
            const maskB = loadMaskFromCachedFile()
            interpolate_mask_a = maskA.mask
            interpolate_mask_b = maskB.mask

            frame.frameIdProvider.subscribe((v) => {
                const { firstFrameId, lastFrameId, currentFrameIdIndex, frameCount } = frame.frameIdProvider.get()
                const ratio = frameCount <= 1 ? 0 : currentFrameIdIndex / (frameCount - 1)

                resizeNode.inputs.interpolate_ratio = ratio
                maskA.loadMaskImageNode.inputs.current_frame = firstFrameId
                maskB.loadMaskImageNode.inputs.current_frame = lastFrameId
            })
        }

        const resizeNode = graph.RL$_Crop$_Resize({
            image: startImage,
            mask: cropMask,
            padding: form.padding,
            max_side_length: form.size.maxSideLength ?? undefined,
            width: form.size.target?.width ?? undefined,
            height: form.size.target?.height ?? undefined,
            interpolate_mask_a,
            interpolate_mask_b,
            interpolate_ratio: 0,
        })

        const {
            cropped_image: croppedImage,
            cropped_mask: croppedMask,
            left_source,
            right_source,
            top_source,
            bottom_source,
        } = resizeNode.outputs

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

        if (form.storeVariables?.beforeCropImage) {
            storageOperations.storeImageVarible.run(state, { name: form.storeVariables.beforeCropImage }, { ...frame, image })
        }
        if (form.storeVariables?.afterCropImage) {
            storageOperations.storeImageVarible.run(
                state,
                { name: form.storeVariables.afterCropImage },
                { ...frame, image: croppedImage },
            )
        }
        if (form.storeVariables?.beforeCropMask) {
            storageOperations.storeMaskVariable.run(state, { name: form.storeVariables.beforeCropMask }, { ...frame, mask })
        }
        if (form.storeVariables?.afterCropMask) {
            storageOperations.storeMaskVariable.run(
                state,
                { name: form.storeVariables.afterCropMask },
                { ...frame, mask: croppedMask },
            )
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

const uncrop = createFrameOperation({
    options: {
        hideLoadVariables: true,
    },
    ui: (form) => ({
        variables: form.group({
            items: () => ({
                beforeCropImage: form.str({ default: `beforeCropImage` }),
                cropAreaMask: form.str({ default: `cropAreaMask` }),
                pasteImage: form.str({ default: `pasteImage` }),
                pasteMask: form.str({ default: `pasteMask` }),
            }),
        }),
    }),
    run: (state, form, { image, mask }) => {
        const { graph } = state

        const beforeCropImage = loadFromScope<_IMAGE>(state, form.variables.beforeCropImage) ?? image
        const cropAreaMask = loadFromScope<_MASK>(state, form.variables.cropAreaMask) ?? mask
        const pasteImage = loadFromScope<_IMAGE>(state, form.variables.pasteImage) ?? image
        const pasteMask = loadFromScope<_MASK>(state, form.variables.pasteMask) ?? mask
        const cropAreaMaskImage = graph.MaskToImage({
            mask: cropAreaMask,
        })
        const pasteMaskImage = graph.MaskToImage({
            mask: pasteMask,
        })

        const uncroppedReplaceMaskImage = graph.Paste_By_Mask({
            image_base: cropAreaMaskImage,
            image_to_paste: pasteMaskImage,
            mask: cropAreaMaskImage,
            resize_behavior: `resize`,
        }).outputs.IMAGE

        const uncroppedFinalImage = graph.Paste_By_Mask({
            image_base: beforeCropImage,
            image_to_paste: pasteImage,
            mask: cropAreaMaskImage,
            resize_behavior: `resize`,
        }).outputs.IMAGE

        const restoredImage = graph.Image_Blend_by_Mask({
            image_a: beforeCropImage,
            image_b: uncroppedFinalImage,
            mask: uncroppedReplaceMaskImage,
            blend_percentage: 1,
        }).outputs.IMAGE

        return { image: restoredImage }
    },
})
const upscaleWithModel = createFrameOperation({
    ui: (form) => ({
        model: form.enum({
            enumName: `Enum_UpscaleModelLoader_model_name`,
            default: `8x_NMKD-Superscale_150000_G.pth`,
        }),
        resize: form.choice({
            items: () => ({
                none: form.bool({ default: false }),
                ratio: form.float({ default: 1 }),
                maxSideLength: form.int({ default: 1024 }),
                // targetWidth: form.int({ default: 1024 }),
                // targetHeight: form.int({ default: 1024 }),
            }),
        }),
    }),
    run: ({ graph }, form, { image, mask }) => {
        const upscaledImage = graph.ImageUpscaleWithModel({
            image,
            upscale_model: graph.UpscaleModelLoader({
                model_name: form.model,
            }),
        }).outputs.IMAGE

        const resizedImage = form.resize.ratio
            ? graph.ImageTransformResizeRelative({
                  images: upscaledImage,
                  method: `lanczos`,
                  scale_width: form.resize.ratio,
                  scale_height: form.resize.ratio,
              })
            : form.resize.maxSideLength
            ? graph.RL$_Crop$_Resize({
                  image: upscaledImage,
                  max_side_length: form.resize.maxSideLength,
              })
            : upscaledImage

        const size = graph.Get_image_size({ image: resizedImage })
        const resizedMask = graph.Image_To_Mask({
            method: `intensity`,
            image: graph.ImageTransformResizeAbsolute({
                images: graph.MaskToImage({ mask }),
                method: `lanczos`,
                width: size.outputs.INT,
                height: size.outputs.INT_1,
            }),
        }).outputs.MASK

        return { image: resizedImage, mask: resizedMask }
    },
})

export const resizingOperations = {
    cropResizeByMask,
    uncrop,
    upscaleWithModel,
}
export const resizingOperationsList = createFrameOperationsGroupList(resizingOperations)
