import { PreviewStopError, loadFromScope, storeInScope } from '../_appState'
import { createFrameOperation } from './_frame'

const emptyImage = createFrameOperation({
    ui: (form) => ({
        width: form.int({ default: 512, min: 0 }),
        height: form.int({ default: 512, min: 0 }),
    }),
    run: ({ runtime, graph }, form, { image }) => {
        const resultImage = graph.EmptyImage({
            width: form.width,
            height: form.height,
            color: 0,
        }).outputs.IMAGE

        return { image: resultImage }
    },
})

const zoeDepth = createFrameOperation({
    ui: (form) => ({
        cutoffByMask: form.groupOpt({
            items: () => ({
                variable: form.str({ default: `mask` }),
                erode: form.int({ default: 4, min: 1, max: 64 }),
                // preview: form.inlineRun({}),
            }),
        }),
        cutoffMid: form.float({ default: 0.5, min: 0, max: 1, step: 0.001 }),
        cutoffRadius: form.float({ default: 0.6, min: 0, max: 1, step: 0.001 }),
        invertCutoffMax: form.bool({ default: false }),
        invertCutoffMin: form.bool({ default: false }),
        // normMin: form.float({ default: 2, min: 0, max: 100, step: 0.1 }),
        // normMax: form.float({ default: 85, min: 0, max: 100, step: 0.1 }),
    }),
    run: (state, form, { image, mask }) => {
        const { runtime, graph } = state
        const zoeRaw = graph.RL$_Zoe$_Depth$_Map$_Preprocessor$_Raw$_Infer({
            image,
        })

        const cutoffByMask = form.cutoffByMask
            ? graph.Mask_Erode_Region({
                  masks: loadFromScope<_MASK>(state, form.cutoffByMask.variable) ?? mask,
                  iterations: 4,
              })
            : undefined

        const zoeImages = graph.RL$_Zoe$_Depth$_Map$_Preprocessor$_Raw$_Process({
            zoeRaw,
            cutoffByMask,
            // This makes more sense reversed
            cutoffMid: 1 - form.cutoffMid,
            cutoffRadius: form.cutoffRadius,
            normMin: 1, //form.zoeDepth.normMin,
            normMax: 99, //form.zoeDepth.normMax,
        })
        const zoeImage = graph.ImageBatchGet({
            images: zoeImages,
            index: 2,
        }).outputs.IMAGE

        const zoeRgbImage = graph.Images_to_RGB({
            images: zoeImage,
        })

        let resultImage = zoeRgbImage.outputs.IMAGE
        if (!form.invertCutoffMax && !form.invertCutoffMin) {
            return { image: resultImage }
        }

        const invertedImage = graph.InvertImage({ image: resultImage })

        if (form.invertCutoffMax) {
            const removeMask = graph.ImageColorToMask({
                image: resultImage,
                color: 0xffffff,
            })

            resultImage = graph.Image_Blend_by_Mask({
                image_a: resultImage,
                image_b: invertedImage,
                mask: graph.MaskToImage({ mask: removeMask }),
                blend_percentage: 1,
            }).outputs.IMAGE
            resultImage = graph.Images_to_RGB({ images: resultImage }).outputs.IMAGE
        }
        if (form.invertCutoffMin) {
            const removeMask = graph.ImageColorToMask({
                image: resultImage,
                color: 0,
            })

            resultImage = graph.Image_Blend_by_Mask({
                image_a: resultImage,
                image_b: invertedImage,
                mask: graph.MaskToImage({ mask: removeMask }),
                blend_percentage: 1,
            }).outputs.IMAGE
            resultImage = graph.Images_to_RGB({ images: resultImage }).outputs.IMAGE
        }

        return { image: resultImage }
    },
})

const hedEdge = createFrameOperation({
    ui: (form) => ({}),
    run: ({ runtime, graph }, form, { image }) => {
        const resultImage = graph.HEDPreprocessor({
            image,
            safe: `enable`,
            version: `v1.1`,
        }).outputs.IMAGE

        return { image: resultImage }
    },
})

const pidiEdge = createFrameOperation({
    ui: (form) => ({}),
    run: ({ runtime, graph }, form, { image }) => {
        const resultImage = graph.PiDiNetPreprocessor({
            image,
            safe: `enable`,
        }).outputs.IMAGE

        return { image: resultImage }
    },
})

const scribbleEdge = createFrameOperation({
    ui: (form) => ({}),
    run: ({ runtime, graph }, form, { image }) => {
        const resultImage = graph.ScribblePreprocessor({
            image,
        }).outputs.IMAGE

        return { image: resultImage }
    },
})

const threshold = createFrameOperation({
    ui: (form) => ({
        threshold: form.int({ default: 128, min: 0, max: 255 }),
        invertInput: form.boolean({ default: true }),
        invertOutput: form.boolean({ default: true }),
    }),
    run: ({ runtime, graph }, form, { image }) => {
        const resultImage01 = graph.BinaryPreprocessor({
            image: form.invertInput ? graph.ImageInvert({ image }).outputs.IMAGE : image,
            threshold: form.threshold,
        }).outputs.IMAGE

        // results are inverted from expected
        const resultImage = form.invertOutput ? resultImage01 : graph.ImageInvert({ image: resultImage01 }).outputs.IMAGE

        return { image: resultImage }
    },
})

const grayscale = createFrameOperation({
    ui: (form) => ({}),
    run: ({ runtime, graph }, form, { image }) => {
        const resultImage = graph.ImageEffectsGrayscale({
            images: image,
        }).outputs.IMAGE

        return { image: resultImage }
    },
})

const selectChannel = createFrameOperation({
    ui: (form) => ({
        channel: form.enum.Enum_Image_Select_Channel_channel({}),
    }),
    run: ({ runtime, graph }, form, { image }) => {
        const channelImage = graph.Image_Select_Channel({
            image: image,
            channel: form.channel,
        }).outputs.IMAGE

        const imageSize = graph.Get_image_size({
            image: channelImage,
        })
        const blackImage = graph.EmptyImage({
            width: imageSize.outputs.INT,
            height: imageSize.outputs.INT_1,
        })
        const singleChannel = graph.Image_Mix_RGB_Channels({
            red_channel: form.channel === `red` ? channelImage : blackImage,
            green_channel: form.channel === `green` ? channelImage : blackImage,
            blue_channel: form.channel === `blue` ? channelImage : blackImage,
        }).outputs.IMAGE

        return { image: singleChannel }
    },
})

const adjustChannelLevels = createFrameOperation({
    ui: (form) => ({
        redMin: form.int({ default: 0, min: 0, max: 255 }),
        redMax: form.int({ default: 255, min: 0, max: 255 }),
        greenMin: form.int({ default: 0, min: 0, max: 255 }),
        greenMax: form.int({ default: 255, min: 0, max: 255 }),
        blueMin: form.int({ default: 0, min: 0, max: 255 }),
        blueMax: form.int({ default: 255, min: 0, max: 255 }),
    }),
    run: ({ runtime, graph }, form, { image }) => {
        const imageSize = graph.Get_image_size({
            image,
        })
        const blackImage = graph.EmptyImage({
            width: imageSize.outputs.INT,
            height: imageSize.outputs.INT_1,
        }).outputs.IMAGE
        const adjustChannel = (name: `red` | `green` | `blue`) => {
            const channelImage = graph.Image_Select_Channel({
                image: image,
                channel: `red`,
            }).outputs.IMAGE
            const minLevel = form[`${name}Min`]
            const maxLevel = form[`${name}Max`]
            if (minLevel === maxLevel) {
                return blackImage
            }
            const adjustedChannel = graph.Image_Levels_Adjustment({
                image: channelImage,
                black_level: minLevel,
                white_level: maxLevel,
                mid_level: (minLevel + maxLevel) / 2.0,
            })
            return adjustedChannel.outputs.IMAGE
        }

        const resultImage = graph.Image_Mix_RGB_Channels({
            red_channel: adjustChannel(`red`),
            green_channel: adjustChannel(`green`),
            blue_channel: adjustChannel(`blue`),
        }).outputs.IMAGE

        return { image: resultImage }
    },
})

const baeNormal = createFrameOperation({
    ui: (form) => ({}),
    run: ({ runtime, graph }, form, { image }) => {
        const resultImage = graph.BAE$7NormalMapPreprocessor({
            image,
        }).outputs.IMAGE

        return { image: resultImage }
    },
})

const openPose = createFrameOperation({
    ui: (form) => ({
        body: form.bool({ default: true }),
        face: form.bool({ default: true }),
        hand: form.bool({ default: true }),
    }),
    run: ({ runtime, graph }, form, { image }) => {
        const resultImage = graph.OpenposePreprocessor({
            image,
            detect_body: form.body ? 'enable' : `disable`,
            detect_face: form.face ? 'enable' : `disable`,
            detect_hand: form.hand ? 'enable' : `disable`,
        }).outputs.IMAGE

        return { image: resultImage }
    },
})

const enhanceLighting = createFrameOperation({
    ui: (form) => ({
        // previewAll: form.inlineRun({}),
        preview: form.groupOpt({
            items: () => ({
                img_all: form.inlineRun({}),
                img_intensity: form.inlineRun({}),
                img_gamma: form.inlineRun({}),
                img_log: form.inlineRun({}),
                img_rescale: form.inlineRun({}),
                out_shadows: form.inlineRun({}),
                out_highlights: form.inlineRun({}),
                out_mid: form.inlineRun({}),
                img_eq: form.inlineRun({}),
                img_adaptive: form.inlineRun({}),
                img_eq_local: form.inlineRun({}),
            }),
        }),
        selected: form.selectOne({
            choices: (
                [
                    `img_intensity`,
                    `img_gamma`,
                    `img_log`,
                    `img_rescale`,
                    `out_shadows`,
                    `out_highlights`,
                    `out_mid`,
                    `img_eq`,
                    `img_adaptive`,
                    `img_eq_local`,
                ] as const
            ).map((x) => ({ id: x })),
        }),
        previewSelected: form.inlineRun({}),
    }),
    run: ({ runtime, graph }, form, { image }) => {
        const imageShadowNode = graph.RL$_Image$_Shadow({
            image,
        })

        const activiatePreviewKey = Object.entries(form.preview ?? {}).find(
            ([k, v]) => v,
        )?.[0] as keyof typeof imageShadowNode.outputs
        if (activiatePreviewKey) {
            graph.PreviewImage({
                images: imageShadowNode.outputs[activiatePreviewKey],
            })
            throw new PreviewStopError(undefined)
        }

        const selectedImage = imageShadowNode.outputs[form.selected.id] ?? image
        if (form.previewSelected) {
            graph.PreviewImage({
                images: selectedImage,
            })
            throw new PreviewStopError(undefined)
        }
        return { image: selectedImage }
    },
})

const selectColor = createFrameOperation({
    ui: (form) => ({
        color: form.color({ default: `#000000` }),
        variance: form.int({ default: 10, min: 0, max: 255 }),
    }),
    run: ({ runtime, graph }, form, { image, mask }) => {
        const rgb = Number.parseInt(form.color.slice(1), 16)
        const r = ((rgb / 256 / 256) | 0) % 256
        const g = ((rgb / 256) | 0) % 256
        const b = (rgb | 0) % 256

        const colorImage = graph.Image_Select_Color({
            image,
            red: r,
            green: g,
            blue: b,
            variance: form.variance,
        })

        // const colorMask = graph.Image_To_Mask({
        //     image: colorImage,
        //     method: `intensity`,
        // })

        // const colorMask = graph.ImageColorToMask({
        //     image,
        //     color: Number.parseInt(form.color, 16),
        // })
        // const resultMask = graph.Mask_Dilate_Region({
        //     masks: colorMask,
        //     iterations: 1,
        // }).outputs.MASKS

        return { image: colorImage }
    },
})

const invertImage = createFrameOperation({
    ui: (form) => ({}),
    run: ({ runtime, graph }, form, { image }) => {
        const result = graph.InvertImage({
            image,
        })
        return { image: result }
    },
})

const blendImages = createFrameOperation({
    options: {
        hideLoadVariables: true,
    },
    ui: (form) => ({
        // operation: form.selectOne({
        //     choices: [{ id: `union` }, { id: `intersection` }],
        // }),
        a: form.group({
            layout: `V`,
            items: () => ({
                name: form.string({ default: `a` }),
                // inverse: form.empt,
                // inverse: form.bool({ default: false }),
            }),
        }),
        b: form.group({
            layout: `V`,
            items: () => ({
                name: form.string({ default: `b` }),
                inverse: form.bool({ default: false }),
                blendRatio: form.float({ default: 0.5, min: 0, max: 1, step: 0.01 }),
                blendMode: form.enum.Enum_ImageBlend_blend_mode({ default: `normal` }),
            }),
        }),
        // c: form.groupOpt({
        //     layout: `V`,
        //     items: () => ({
        //         name: form.string({ default: `c` }),
        //         inverse: form.bool({ default: false }),
        //     }),
        // }),
        // d: form.groupOpt({
        //     layout: `V`,
        //     items: () => ({
        //         name: form.string({ default: `d` }),
        //         inverse: form.bool({ default: false }),
        //     }),
        // }),
        // e: form.groupOpt({
        //     layout: `V`,
        //     items: () => ({
        //         name: form.string({ default: `d` }),
        //         inverse: form.bool({ default: false }),
        //     }),
        // }),
    }),
    run: (state, form, { image }) => {
        image = loadFromScope<_IMAGE>(state, form.a.name) ?? image
        const otherImages = [
            form.b,
            // form.blendImages.c, form.blendImages.d, form.blendImages.e
        ]
            .filter((x) => x)
            .map((x) => x!)

        const { graph } = state

        for (const item of otherImages) {
            let itemImage = loadFromScope<_IMAGE>(state, item.name)
            if (!itemImage) {
                continue
            }

            itemImage = !item.inverse ? itemImage : graph.ImageInvert({ image: itemImage })
            if (!image) {
                image = itemImage
                continue
            }

            if (item === form.a) {
                continue
            }

            image = graph.ImageBlend({
                image1: image,
                image2: itemImage,
                blend_mode: item.blendMode,
                blend_factor: item.blendRatio,
            })
        }

        return { image }
    },
})

export const imageOperations = {
    emptyImage,
    enhanceLighting,
    zoeDepth,
    hedEdge,
    pidiEdge,
    scribbleEdge,
    baeNormal,
    openPose,
    threshold,
    grayscale,
    selectChannel,
    selectColor,
    invertImage,
    adjustChannelLevels,
    blendImages,
}
