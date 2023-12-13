import { StopError, loadFromScope, storeInScope } from '../_appState'
import { createFrameOperation, createFrameOperationsGroupList } from './_frame'

const zoeDepth = createFrameOperation({
    ui: (form) => ({
        cutoffMid: form.float({ default: 0.5, min: 0, max: 1, step: 0.001 }),
        cutoffRadius: form.float({ default: 0.1, min: 0, max: 1, step: 0.001 }),
        invertCutoffMax: form.bool({ default: false }),
        invertCutoffMin: form.bool({ default: false }),
        // normMin: form.float({ default: 2, min: 0, max: 100, step: 0.1 }),
        // normMax: form.float({ default: 85, min: 0, max: 100, step: 0.1 }),
    }),
    run: ({ runtime, graph }, form, { image }) => {
        const zoeRaw = graph.RL$_Zoe$_Depth$_Map$_Preprocessor$_Raw$_Infer({
            image,
        })

        const zoeImages = graph.RL$_Zoe$_Depth$_Map$_Preprocessor$_Raw$_Process({
            zoeRaw,
            // This makes more sense reversed
            cutoffMid: 1 - form.cutoffMid,
            cutoffRadius: form.cutoffRadius,
            normMin: 0, //form.zoeDepth.normMin,
            normMax: 100, //form.zoeDepth.normMax,
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
    }),
    run: ({ runtime, graph }, form, { image }) => {
        const resultImage = graph.BinaryPreprocessor({
            image,
            threshold: form.threshold,
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
        body: form.bool({}),
        face: form.bool({}),
        hand: form.bool({}),
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
            throw new StopError(() => {})
        }

        const selectedImage = imageShadowNode.outputs[form.selected.id] ?? image
        if (form.previewSelected) {
            graph.PreviewImage({
                images: selectedImage,
            })
            throw new StopError(() => {})
        }
        return { image: selectedImage }
    },
})

const colorSelect = createFrameOperation({
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

const blendImages = createFrameOperation({
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
                blendMode: form.enum({ enumName: `Enum_ImageBlend_blend_mode`, default: `normal` }),
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
    enhanceLighting,
    zoeDepth,
    hedEdge,
    pidiEdge,
    scribbleEdge,
    baeNormal,
    openPose,
    threshold,
    colorSelect,
    blendImages,
}
export const imageOperationsList = createFrameOperationsGroupList(imageOperations)
