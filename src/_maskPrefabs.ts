import { FormBuilder, Runtime, Widget } from 'src'
import { ComfyWorkflowBuilder } from 'src/back/NodeBuilder'
import { WidgetDict } from 'src/cards/Card'
import { AppState, PreviewStopError, storeInScope, loadFromScope } from './_appState'

type MaskOperation<TFields extends WidgetDict> = {
    ui: (form: FormBuilder) => TFields
    run: (
        state: AppState,
        image: _IMAGE,
        mask: undefined | _MASK,
        form: { [k in keyof TFields]: TFields[k]['$Output'] },
    ) => undefined | _MASK
}
const createMaskOperation = <TFields extends WidgetDict>(op: MaskOperation<TFields>): MaskOperation<TFields> => op
const createMaskOperationValue = <TValue extends Widget>(op: {
    ui: (form: FormBuilder) => TValue
    run: (state: AppState, image: _IMAGE, mask: undefined | _MASK, form: TValue['$Output']) => undefined | _MASK
}) => op

const operation_clipSeg = createMaskOperation({
    ui: (form) => ({
        clipSeg: form.groupOpt({
            items: () => ({
                prompt: form.str({ default: `ball` }),
                threshold: form.float({ default: 0.4, min: 0, max: 1, step: 0.01 }),
                dilation: form.int({ default: 4, min: 0 }),
                blur: form.float({ default: 1, min: 0 }),
            }),
        }),
    }),
    run: ({ runtime, graph }, image, mask, form) => {
        if (form.clipSeg == null) {
            return mask
        }

        const clipMask = graph.CLIPSeg({
            image: image,
            text: form.clipSeg.prompt,
            threshold: form.clipSeg.threshold,
            dilation_factor: form.clipSeg.dilation,
            blur: form.clipSeg.blur,
        }).outputs.Mask

        return clipMask
    },
})

const operation_color = createMaskOperation({
    ui: (form) => ({
        color: form.groupOpt({
            items: () => ({
                intensity: form.int({ default: 0, min: 0, max: 255 }),
            }),
        }),
    }),
    run: ({ runtime, graph }, image, mask, form) => {
        if (form.color == null) {
            return mask
        }

        const colorMask = graph.ImageColorToMask({
            image,
            color: form.color.intensity,
        })
        const dilated = graph.Mask_Dilate_Region({
            masks: colorMask,
            iterations: 1,
        }).outputs.MASKS

        return dilated
    },
})

const operation_erodeOrDilate = createMaskOperation({
    ui: (form) => ({
        erodeOrDilate: form.intOpt({ min: -64, max: 64 }),
    }),
    run: ({ runtime, graph }, image, mask, form) => {
        if (form.erodeOrDilate == null) {
            return mask
        }
        if (!mask) {
            return mask
        }

        const maskDilated =
            form.erodeOrDilate > 0
                ? graph.Mask_Dilate_Region({ masks: mask, iterations: form.erodeOrDilate }).outputs.MASKS
                : form.erodeOrDilate < 0
                ? graph.Mask_Erode_Region({ masks: mask, iterations: -form.erodeOrDilate }).outputs.MASKS
                : mask
        return maskDilated
    },
})

const operation_segment = createMaskOperation({
    ui: (form) => ({
        segmentIndex: form.intOpt({ min: 0, max: 10 }),
    }),
    run: ({ runtime, graph }, image, mask, form) => {
        if (form.segmentIndex == null) {
            return mask
        }
        if (!mask) {
            return mask
        }

        const segs = graph.MaskToSEGS({
            mask,
        })

        const segsFilter = graph.ImpactSEGSOrderedFilter({
            segs,
            target: `area(=w*h)`,
            take_start: form.segmentIndex,
        })

        mask = graph.SegsToCombinedMask({ segs: segsFilter.outputs.filtered_SEGS }).outputs.MASK

        return mask
    },
})

const operation_sam = createMaskOperation({
    ui: (form) => ({
        sam: form.groupOpt({
            items: () => ({
                // prompt: form.str({ default: `ball` }),
                threshold: form.float({ default: 0.4, min: 0, max: 1, step: 0.01 }),
                detection_hint: form.enum({
                    enumName: `Enum_SAMDetectorCombined_detection_hint`,
                    default: `center-1`,
                }),
                mask_hint_use_negative: form.enum({
                    enumName: `Enum_SAMDetectorCombined_mask_hint_use_negative`,
                    default: `False`,
                }),
                // dilation: form.int({ default: 4, min: 0 }),
                // blur: form.float({ default: 1, min: 0 }),
            }),
        }),
    }),
    run: ({ runtime, graph }, image, mask, form) => {
        if (form.sam == null) {
            return mask
        }
        if (!mask) {
            return mask
        }

        const samModel = graph.SAMLoader({
            model_name: `sam_vit_b_01ec64.pth`,
            device_mode: `Prefer GPU`,
        })

        const segs = graph.MaskToSEGS({
            mask,
        })

        mask = graph.SAMDetectorSegmented({
            segs,
            sam_model: samModel,
            image,
            detection_hint: form.sam.detection_hint,
            mask_hint_use_negative: form.sam.mask_hint_use_negative,
            threshold: form.sam.threshold,
        }).outputs.combined_mask

        return mask
    },
})

const operation_storeMask = createMaskOperation({
    ui: (form) => ({
        storeMask: form.groupOpt({
            items: () => ({
                name: form.string({ default: `a` }),
            }),
        }),
    }),
    run: (state, image, mask, form) => {
        if (form.storeMask == null) {
            return mask
        }

        storeInScope(state, form.storeMask.name, `mask`, mask ?? null)
        return mask
    },
})

const operation_combineMasks = createMaskOperation({
    ui: (form) => ({
        combineMasks: form.groupOpt({
            items: () => ({
                operation: form.selectOne({
                    choices: [{ id: `union` }, { id: `intersection` }],
                }),
                a: form.group({
                    layout: `V`,
                    items: () => ({
                        name: form.string({ default: `a` }),
                        inverse: form.bool({ default: false }),
                    }),
                }),
                b: form.group({
                    layout: `V`,
                    items: () => ({
                        name: form.string({ default: `b` }),
                        inverse: form.bool({ default: false }),
                    }),
                }),
                c: form.groupOpt({
                    layout: `V`,
                    items: () => ({
                        name: form.string({ default: `c` }),
                        inverse: form.bool({ default: false }),
                    }),
                }),
                d: form.groupOpt({
                    layout: `V`,
                    items: () => ({
                        name: form.string({ default: `d` }),
                        inverse: form.bool({ default: false }),
                    }),
                }),
                e: form.groupOpt({
                    layout: `V`,
                    items: () => ({
                        name: form.string({ default: `d` }),
                        inverse: form.bool({ default: false }),
                    }),
                }),
            }),
        }),
    }),
    run: (state, image, mask, form) => {
        if (form.combineMasks == null) {
            return mask
        }

        mask = undefined
        const otherMasks = [
            form.combineMasks.a,
            form.combineMasks.b,
            form.combineMasks.c,
            form.combineMasks.d,
            form.combineMasks.e,
        ]
            .filter((x) => x)
            .map((x) => x!)

        const { graph } = state

        for (const mItem of otherMasks) {
            const m = loadFromScope<_MASK>(state, mItem.name)
            if (!m) {
                continue
            }

            const mInverted = !mItem.inverse ? m : graph.InvertMask({ mask: m })
            if (!mask) {
                mask = mInverted
                continue
            }

            mask = run_combineMasks(graph, mask, mInverted, form.combineMasks.operation.id)
        }

        return mask
    },
})

export const run_combineMasks = (
    graph: ComfyWorkflowBuilder,
    a: _MASK,
    b: _MASK,
    operation: `union` | `intersection` | `aNotB`,
) => {
    if (operation === `aNotB`) {
        b = graph.InvertMask({ mask: b })
    }

    return graph.ImageToMask$_AS({
        image: graph.Combine_Masks({
            image1: graph.MaskToImage({ mask: a }),
            image2: graph.MaskToImage({ mask: b }),
            op: operation === `union` ? `union (max)` : `intersection (min)`,
            clamp_result: `yes`,
            round_result: `no`,
        }).outputs.IMAGE,
    }).outputs.MASK
}

// const operation_combineWithMasks = createMaskOperation({
//     ui: (form) => ({
//         combineWithMasks: form.groupOpt({
//             items: () => ({
//                 operation: form.selectOne({
//                     choices: [{ id: `union` }, { id: `intersection` }],
//                 }),
//                 a: form.group({
//                     layout: `V`,
//                     items: () => ({
//                         name: form.string({ default: `a` }),
//                         inverse: form.bool({ default: false }),
//                     }),
//                 }),
//                 b: form.groupOpt({
//                     layout: `V`,
//                     items: () => ({
//                         name: form.string({ default: `b` }),
//                         inverse: form.bool({ default: false }),
//                     }),
//                 }),
//                 c: form.groupOpt({
//                     layout: `V`,
//                     items: () => ({
//                         name: form.string({ default: `c` }),
//                         inverse: form.bool({ default: false }),
//                     }),
//                 }),
//                 d: form.groupOpt({
//                     layout: `V`,
//                     items: () => ({
//                         name: form.string({ default: `d` }),
//                         inverse: form.bool({ default: false }),
//                     }),
//                 }),
//                 e: form.groupOpt({
//                     layout: `V`,
//                     items: () => ({
//                         name: form.string({ default: `d` }),
//                         inverse: form.bool({ default: false }),
//                     }),
//                 }),
//             }),
//         }),
//     }),
//     run: async (state, image, mask, form) => {
//         if (form.combineWithMasks == null) {
//             return mask
//         }

//         const otherMasks = [
//             form.combineWithMasks.a,
//             form.combineWithMasks.b,
//             form.combineWithMasks.c,
//             form.combineWithMasks.d,
//             form.combineWithMasks.e,
//         ]
//             .filter((x) => x)
//             .map((x) => x!)

//         const { graph } = state

//         for (const mItem of otherMasks) {
//             const m = loadFromScope<_MASK>(state, mItem.name)
//             if (!m) {
//                 continue
//             }

//             const mInverted = !mItem.inverse ? m : graph.InvertMask({ mask: m })
//             if (!mask) {
//                 mask = mInverted
//                 continue
//             }

//             mask = run_combineMasks(graph, mask, mInverted, form.combineWithMasks.operation.id)
//         }

//         return mask
//     },
// })

const operations_all = createMaskOperation({
    ui: (form) => ({
        maskOperations: form.list({
            element: () =>
                form.group({
                    layout: 'V',
                    items: () => ({
                        ...operation_clipSeg.ui(form),
                        ...operation_color.ui(form),
                        ...operation_segment.ui(form),
                        ...operation_sam.ui(form),
                        ...operation_erodeOrDilate.ui(form),
                        // ...operation_combineWithMasks.ui(form),
                        ...operation_storeMask.ui(form),
                        ...operation_combineMasks.ui(form),
                        preview: form.inlineRun({}),
                    }),
                }),
        }),
    }),
    run: (state, image, mask, form) => {
        const { runtime, graph } = state

        for (const op of form.maskOperations) {
            mask = operation_clipSeg.run(state, image, mask, op)
            mask = operation_color.run(state, image, mask, op)
            mask = operation_segment.run(state, image, mask, op)
            mask = operation_sam.run(state, image, mask, op)
            mask = operation_erodeOrDilate.run(state, image, mask, op)
            mask = operation_storeMask.run(state, image, mask, op)
            mask = operation_combineMasks.run(state, image, mask, op)
            // mask = await operation_combineWithMasks.run(state, image, mask, op)

            if (op.preview) {
                if (!mask) {
                    runtime.output_text(`No mask!`)
                    throw new PreviewStopError(undefined)
                }

                const maskAsImage = graph.MaskToImage({ mask })
                const maskPreview = graph.ImageBlend({
                    image1: maskAsImage,
                    image2: image,
                    blend_mode: `normal`,
                    blend_factor: 0.5,
                })
                // graph.PreviewImage({ images: maskRaw.outputs.Heatmap$_Mask })
                graph.PreviewImage({ images: maskPreview })
                // don't wait for it?
                throw new PreviewStopError(undefined)
            }
        }

        return mask
    },
})

export const operation_mask = createMaskOperationValue({
    ui: (form) => operations_all.ui(form).maskOperations,
    run: (state, image, mask, form) => operations_all.run(state, image, mask, { maskOperations: form }),
})

// export const ui_maskItemPrompt = (
//     form: FormBuilder,
//     { defaultPrompt, showUnmask = true }: { defaultPrompt?: string; showUnmask?: boolean } = {},
// ) => {
//     return form.group({
//         layout: 'V',
//         items: () => ({
//             prompt: form.str({ default: defaultPrompt ?? `ball` }),
//             ...(!showUnmask ? {} : { unmask: form.bool({ default: false }) }),
//             threshold: form.float({ default: 0.4, min: 0, max: 1, step: 0.01 }),
//             dilation: form.int({ default: 4, min: 0 }),
//             blur: form.float({ default: 1, min: 0 }),
//             ...operation_erodeOrDilate.ui(form),
//             preview: form.inlineRun({}),
//         }),
//     })
// }

// export const ui_maskPrompt = (form: FormBuilder, options: { defaultPrompt?: string } = {}) => {
//     return form.group({
//         layout: 'V',
//         items: () => ({
//             ...operation_all.ui(form),
//             parts: form.list({
//                 element: () => ui_maskItemPrompt(form, options),
//             }),
//             segmentIndex: form.intOpt({ default: 0, min: 0, max: 10 }),
//             samDetectorThreshold: form.floatOpt({ default: 0.4, min: 0, max: 1.0 }),
//             ...operation_erodeOrDilate.ui(form),
//             preview: form.inlineRun({}),
//         }),
//     })
// }

// type MaskForm = ReturnType<typeof ui_maskPrompt>

// export const run_buildMasks = async (
//     runtime: {
//         PROMPT: () => Promise<unknown>
//         print: (message: string) => void
//     },
//     graph: ComfyWorkflowBuilder,
//     image: _IMAGE,
//     maskForm: MaskForm['$Output'],
// ) => {
//     let state = { runtime, graph, scopeStack: [{}] }
//     let test = await operation_all.run(state, image, undefined, maskForm)

//     let mask = undefined as undefined | _MASK
//     let unmask = undefined as undefined | _MASK
//     for (const x of maskForm.parts) {
//         const maskRaw = graph.CLIPSeg({
//             image: image,
//             text: x.prompt,
//             threshold: x.threshold,
//             dilation_factor: x.dilation,
//             blur: x.blur,
//         })

//         const maskDilated = (await operation_erodeOrDilate.run(state, image, maskRaw, x)) ?? maskRaw

//         if (!x.unmask) {
//             mask = !mask ? maskDilated : run_combineMasks(graph, mask, maskDilated, `union`)
//         } else {
//             unmask = !unmask ? maskDilated : run_combineMasks(graph, unmask, maskDilated, `union`)
//         }

//         if (x.preview) {
//             const maskAsImage = graph.MaskToImage({ mask: maskDilated })
//             const maskPreview = graph.ImageBlend({
//                 image1: maskAsImage,
//                 image2: image,
//                 blend_mode: `normal`,
//                 blend_factor: 0.5,
//             })
//             graph.PreviewImage({ images: maskRaw.outputs.Heatmap$_Mask })
//             graph.PreviewImage({ images: maskPreview })
//             await runtime.PROMPT()
//             return { stop: true }
//         }
//     }

//     mask = !mask || !unmask ? mask : run_combineMasks(graph, mask, unmask, `aNotB`)

//     if (mask && maskForm.segmentIndex != null) {
//         const segs = graph.MaskToSEGS({
//             mask,
//         })

//         const segsFilter = graph.ImpactSEGSOrderedFilter({
//             segs,
//             target: `area(=w*h)`,
//             take_start: maskForm.segmentIndex,
//         })

//         mask = graph.SegsToCombinedMask({ segs: segsFilter.outputs.filtered_SEGS })
//     }

//     if (mask && maskForm.samDetectorThreshold != null) {
//         const samModel = graph.SAMLoader({
//             model_name: `sam_vit_b_01ec64.pth`,
//             device_mode: `Prefer GPU`,
//         })

//         const segs = graph.MaskToSEGS({
//             mask,
//         })

//         mask = graph.SAMDetectorSegmented({
//             segs,
//             sam_model: samModel,
//             image,
//             detection_hint: `center-1`,
//             mask_hint_use_negative: `False`,
//         }).outputs.combined_mask
//     }

//     if (mask && maskForm.erodeOrDilate !== 0) {
//         mask = await operation_erodeOrDilate.run(state, image, mask, maskForm)
//     }

//     if (maskForm.preview) {
//         if (!mask) {
//             runtime.print(`No Mask Defined`)
//             return { stop: true }
//         }
//         const maskAsImage = graph.MaskToImage({ mask })
//         const maskPreview = graph.ImageBlend({
//             image1: maskAsImage,
//             image2: image,
//             blend_mode: `normal`,
//             blend_factor: 0.5,
//         })
//         graph.PreviewImage({ images: maskPreview })
//         await runtime.PROMPT()
//         return { stop: true }
//     }

//     return { mask, stop: false }
// }
