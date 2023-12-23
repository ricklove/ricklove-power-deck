import { loadFromScope, loadFromScopeWithExtras } from '../_appState'
import { createFrameOperation, getCacheFilePattern } from './_frame'
import { storageOperations } from './storage'

const cropResizeByMask = createFrameOperation({
    options: {
        hideStoreVariables: true,
    },
    ui: (form) => ({
        padding: form.int({ default: 0 }),
        size: form.choice({
            items: () => ({
                maxSideLength: form.int({ default: 1024 }),
                target: form.group({
                    items: () => ({
                        width: form.int({ default: 1024 }),
                        height: form.int({ default: 1024 }),
                    }),
                }),
                standard: form.group({
                    items: () => ({
                        landscape: form.bool({}),
                        size: form.selectOne({
                            choices: () => [
                                { id: `sd    1 x 1 =  512x 512` },
                                { id: `sd    1 x 2 =  384x 768` },
                                { id: `sd    2 x 3 =  512x 768` },
                                { id: `sdxl  1 x 1 = 1024x1024` },
                                { id: `sdxl  3 x 4 =  896x1152` },
                                { id: `sdxl  2 x 3 =  832x1216` },
                                { id: `sdxl  9 x16 =  768x1344` },
                                { id: `sdxl 10 x24 =  640x1536` },
                            ],
                        }),
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
            default: true,
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

        const getTargetSize = (input: typeof form.size) => {
            if (input.maxSideLength) {
                return {}
            }

            if (input.target) {
                return { width: input.target.width, height: input.target.height }
            }

            const [_id, values] = input.standard?.size.id.split(`=`) ?? []
            const [xRaw, yRaw] = values?.split(`x`) ?? []
            const [x, y] = input.standard?.landscape ? [yRaw, xRaw] : [xRaw, yRaw]
            const [w, h] = [x, y].map((v) => (v ? Number(v) : undefined))

            return { width: w, height: h }
        }
        const targetSize = getTargetSize(form.size)

        const resizeNode = graph.RL$_Crop$_Resize({
            image: startImage,
            mask: cropMask,
            padding: form.padding,
            max_side_length: form.size.maxSideLength,
            width: targetSize.width,
            height: targetSize.height,
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

        const originalSize = graph.Get_image_size({
            image,
        })

        const resizedImage = form.resize.ratio
            ? graph.ImageTransformResizeAbsolute({
                  images: upscaledImage,
                  method: `lanczos`,
                  width: graph.Evaluate_Floats({
                      a: graph.Int_to_float({ Value: originalSize.outputs.INT }),
                      python_expression: `a*${form.resize.ratio}`,
                      print_to_console: `False`,
                  }).outputs.INT,
                  height: graph.Evaluate_Floats({
                      a: graph.Int_to_float({ Value: originalSize.outputs.INT_1 }),
                      python_expression: `a*${form.resize.ratio}`,
                      print_to_console: `False`,
                  }).outputs.INT,
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
