import { FormBuilder, Runtime, Widget } from 'src'
import { ComfyWorkflowBuilder } from 'src/back/NodeBuilder'
import { WidgetDict } from 'src/cards/Card'
import { AppState, StopError, storeInScope, loadFromScope } from './_appState'

type ImageOperation<TFields extends WidgetDict> = {
    ui: (form: FormBuilder) => TFields
    run: (state: AppState, image: _IMAGE, form: { [k in keyof TFields]: TFields[k]['$Output'] }) => _IMAGE
}
const createImageOperation = <TFields extends WidgetDict>(op: ImageOperation<TFields>): ImageOperation<TFields> => op
const createImageOperationValue = <TValue extends Widget>(op: {
    ui: (form: FormBuilder) => TValue
    run: (state: AppState, image: _IMAGE, form: TValue['$Output']) => _IMAGE
}) => op

const operation_zoeDepthPreprocessor = createImageOperation({
    ui: (form) => ({
        zoeDepth: form.groupOpt({
            items: () => ({
                cutoffMid: form.float({ default: 0.5, min: 0, max: 1, step: 0.001 }),
                cutoffRadius: form.float({ default: 0.1, min: 0, max: 1, step: 0.001 }),
                // normMin: form.float({ default: 2, min: 0, max: 100, step: 0.1 }),
                // normMax: form.float({ default: 85, min: 0, max: 100, step: 0.1 }),
                // minDepth
                // maxDepth
                // prompt: form.str({ default: `ball` }),
                // threshold: form.float({ default: 0.4, min: 0, max: 1, step: 0.01 }),
                // dilation: form.int({ default: 4, min: 0 }),
                // blur: form.float({ default: 1, min: 0 }),
            }),
        }),
    }),
    run: ({ runtime, graph }, image, form) => {
        if (form.zoeDepth == null) {
            return image
        }

        // const zoeImage = graph.Zoe$7DepthMapPreprocessor({
        //     image: image,
        // }).outputs.IMAGE

        const zoeRaw = graph.RL$_Zoe$_Depth$_Map$_Preprocessor$_Raw$_Infer({
            image,
        })

        const zoeImages = graph.RL$_Zoe$_Depth$_Map$_Preprocessor$_Raw$_Process({
            zoeRaw,
            cutoffMid: form.zoeDepth.cutoffMid,
            cutoffRadius: form.zoeDepth.cutoffRadius,
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

        return zoeRgbImage
    },
})

const operation_hedEdgePreprocessor = createImageOperation({
    ui: (form) => ({
        hedEdge: form.groupOpt({
            items: () => ({}),
        }),
    }),
    run: ({ runtime, graph }, image, form) => {
        if (form.hedEdge == null) {
            return image
        }

        const hedImage = graph.HEDPreprocessor({
            image,
            safe: `enable`,
            version: `v1.1`,
        }).outputs.IMAGE

        return hedImage
    },
})

const operation_pidiEdgePreprocessor = createImageOperation({
    ui: (form) => ({
        pidiEdge: form.groupOpt({
            items: () => ({}),
        }),
    }),
    run: ({ runtime, graph }, image, form) => {
        if (form.pidiEdge == null) {
            return image
        }

        const pidiEdgeImage = graph.PiDiNetPreprocessor({
            image,
            safe: `enable`,
        }).outputs.IMAGE

        return pidiEdgeImage
    },
})

const operation_scribbleEdgePreprocessor = createImageOperation({
    ui: (form) => ({
        scribbleEdge: form.groupOpt({
            items: () => ({}),
        }),
    }),
    run: ({ runtime, graph }, image, form) => {
        if (form.scribbleEdge == null) {
            return image
        }

        const resultImage = graph.ScribblePreprocessor({
            image,
        }).outputs.IMAGE

        return resultImage
    },
})

const operation_thresholdPreprocessor = createImageOperation({
    ui: (form) => ({
        threshold: form.groupOpt({
            items: () => ({
                threshold: form.int({ default: 128, min: 0, max: 255 }),
            }),
        }),
    }),
    run: ({ runtime, graph }, image, form) => {
        if (form.threshold == null) {
            return image
        }

        const resultImage = graph.BinaryPreprocessor({
            image,
            threshold: form.threshold.threshold,
        }).outputs.IMAGE

        return resultImage
    },
})

const operation_baeNormalPreprocessor = createImageOperation({
    ui: (form) => ({
        baeNorma: form.groupOpt({
            items: () => ({}),
        }),
    }),
    run: ({ runtime, graph }, image, form) => {
        if (form.baeNorma == null) {
            return image
        }

        const baeNormalImage = graph.BAE$7NormalMapPreprocessor({
            image,
        }).outputs.IMAGE

        return baeNormalImage
    },
})

const operation_openPosePreprocessor = createImageOperation({
    ui: (form) => ({
        openPose: form.groupOpt({
            items: () => ({
                body: form.bool({}),
                face: form.bool({}),
                hand: form.bool({}),
            }),
        }),
    }),
    run: ({ runtime, graph }, image, form) => {
        if (form.openPose == null) {
            return image
        }

        const openPoseImage = graph.OpenposePreprocessor({
            image,
            detect_body: form.openPose.body ? 'enable' : `disable`,
            detect_face: form.openPose.face ? 'enable' : `disable`,
            detect_hand: form.openPose.hand ? 'enable' : `disable`,
        }).outputs.IMAGE

        return openPoseImage
    },
})

const operation_enhanceLighting = createImageOperation({
    ui: (form) => ({
        enhanceLighting: form.groupOpt({
            items: () => ({
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
        }),
    }),
    run: ({ runtime, graph }, image, form) => {
        if (form.enhanceLighting == null) {
            return image
        }

        // const zoeImage = graph.Zoe$7DepthMapPreprocessor({
        //     image: image,
        // }).outputs.IMAGE

        const imageShadowNode = graph.RL$_Image$_Shadow({
            image,
        })

        const activiatePreviewKey = Object.entries(form.enhanceLighting.preview ?? {}).find(
            ([k, v]) => v,
        )?.[0] as keyof typeof imageShadowNode.outputs
        if (activiatePreviewKey) {
            graph.PreviewImage({
                images: imageShadowNode.outputs[activiatePreviewKey],
            })
            throw new StopError(() => {})
        }

        const selectedImage = imageShadowNode.outputs[form.enhanceLighting.selected.id] ?? image
        if (form.enhanceLighting.previewSelected) {
            graph.PreviewImage({
                images: selectedImage,
            })
            throw new StopError(() => {})
        }
        return selectedImage
    },
})

const operation_blendImages = createImageOperation({
    ui: (form) => ({
        blendImages: form.groupOpt({
            items: () => ({
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
        }),
    }),
    run: (state, image, form) => {
        if (form.blendImages == null) {
            return image
        }

        image = loadFromScope<_IMAGE>(state, form.blendImages.a.name) ?? image
        const otherImages = [
            form.blendImages.b,
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

            if (item === form.blendImages.a) {
                continue
            }

            image = graph.ImageBlend({
                image1: image,
                image2: itemImage,
                blend_mode: item.blendMode,
                blend_factor: item.blendRatio,
            })
        }

        return image
    },
})

const operation_storeImage = createImageOperation({
    ui: (form) => ({
        storeImage: form.groupOpt({
            items: () => ({
                name: form.string({ default: `a` }),
            }),
        }),
    }),
    run: (state, image, form) => {
        if (form.storeImage == null) {
            return image
        }

        storeInScope(state, form.storeImage.name, image)
        return image
    },
})

const operation_loadImage = createImageOperation({
    ui: (form) => ({
        loadImage: form.groupOpt({
            items: () => ({
                name: form.string({ default: `a` }),
            }),
        }),
    }),
    run: (state, image, form) => {
        if (form.loadImage == null) {
            return image
        }

        return loadFromScope(state, form.loadImage.name) ?? image
    },
})

const operations_all = createImageOperation({
    ui: (form) => ({
        imageOperations: form.list({
            element: () =>
                form.group({
                    layout: 'V',
                    items: () => ({
                        ...operation_loadImage.ui(form),
                        ...operation_enhanceLighting.ui(form),
                        ...operation_zoeDepthPreprocessor.ui(form),
                        ...operation_hedEdgePreprocessor.ui(form),
                        ...operation_pidiEdgePreprocessor.ui(form),
                        ...operation_scribbleEdgePreprocessor.ui(form),
                        ...operation_baeNormalPreprocessor.ui(form),
                        ...operation_openPosePreprocessor.ui(form),
                        ...operation_thresholdPreprocessor.ui(form),
                        ...operation_blendImages.ui(form),
                        ...operation_storeImage.ui(form),
                        preview: form.inlineRun({}),
                    }),
                }),
        }),
    }),
    run: (state, image, form) => {
        const { runtime, graph } = state

        for (const op of form.imageOperations) {
            image = operation_loadImage.run(state, image, op)
            image = operation_enhanceLighting.run(state, image, op)
            image = operation_zoeDepthPreprocessor.run(state, image, op)
            image = operation_hedEdgePreprocessor.run(state, image, op)
            image = operation_pidiEdgePreprocessor.run(state, image, op)
            image = operation_scribbleEdgePreprocessor.run(state, image, op)
            image = operation_baeNormalPreprocessor.run(state, image, op)
            image = operation_openPosePreprocessor.run(state, image, op)
            image = operation_thresholdPreprocessor.run(state, image, op)
            image = operation_blendImages.run(state, image, op)
            image = operation_storeImage.run(state, image, op)

            if (op.preview) {
                graph.PreviewImage({ images: image })
                // don't wait for it?
                throw new StopError(undefined)
            }
        }

        return image
    },
})

export const operation_image = createImageOperationValue({
    ui: (form) => operations_all.ui(form).imageOperations,
    run: (state, image, form) => operations_all.run(state, image, { imageOperations: form }),
})
