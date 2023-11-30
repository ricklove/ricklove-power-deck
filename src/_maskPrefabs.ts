import { FormBuilder } from 'src'
import { ComfyWorkflowBuilder } from 'src/back/NodeBuilder'

export const ui_maskItemPrompt = (
    form: FormBuilder,
    { defaultPrompt, showUnmask = true }: { defaultPrompt?: string; showUnmask?: boolean } = {},
) => {
    return form.group({
        layout: 'V',
        items: () => ({
            prompt: form.str({ default: defaultPrompt ?? `ball` }),
            ...(!showUnmask ? {} : { unmask: form.bool({ default: false }) }),
            threshold: form.float({ default: 0.4, min: 0, max: 1, step: 0.01 }),
            dilation: form.int({ default: 4, min: 0 }),
            blur: form.float({ default: 1, min: 0 }),
            erodeOrDilate: form.int({ default: 4, min: -64, max: 64 }),
            preview: form.inlineRun({}),
        }),
    })
}

export const ui_maskPrompt = (form: FormBuilder, options: { defaultPrompt?: string } = {}) => {
    return form.group({
        layout: 'V',
        items: () => ({
            parts: form.list({
                element: () => ui_maskItemPrompt(form, options),
            }),
            segmentIndex: form.intOpt({ default: 0, min: 0, max: 10 }),
            samDetectorThreshold: form.floatOpt({ default: 0.4, min: 0, max: 1.0 }),
            erodeOrDilate: form.int({ default: 4, min: -64, max: 64 }),
            preview: form.inlineRun({}),
        }),
    })
}

type MaskForm = ReturnType<typeof ui_maskPrompt>

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
    })
}

export const run_buildMasks = async (
    flow: {
        PROMPT: () => Promise<unknown>
        print: (message: string) => void
    },
    graph: ComfyWorkflowBuilder,
    image: _IMAGE,
    maskForm: MaskForm['$Output'],
) => {
    let mask = undefined as undefined | _MASK
    let unmask = undefined as undefined | _MASK
    for (const x of maskForm.parts) {
        const maskRaw = graph.CLIPSeg({
            image: image,
            text: x.prompt,
            threshold: x.threshold,
            dilation_factor: x.dilation,
            blur: x.blur,
        })

        const maskDilated =
            x.erodeOrDilate > 0
                ? graph.Mask_Dilate_Region({ masks: maskRaw, iterations: x.erodeOrDilate })
                : x.erodeOrDilate < 0
                ? graph.Mask_Erode_Region({ masks: maskRaw, iterations: -x.erodeOrDilate })
                : maskRaw

        if (!x.unmask) {
            mask = !mask ? maskDilated : run_combineMasks(graph, mask, maskDilated, `union`)
        } else {
            unmask = !unmask ? maskDilated : run_combineMasks(graph, unmask, maskDilated, `union`)
        }

        if (x.preview) {
            const maskAsImage = graph.MaskToImage({ mask: maskDilated })
            const maskPreview = graph.ImageBlend({
                image1: maskAsImage,
                image2: image,
                blend_mode: `normal`,
                blend_factor: 0.5,
            })
            graph.PreviewImage({ images: maskRaw.outputs.Heatmap$_Mask })
            graph.PreviewImage({ images: maskPreview })
            await flow.PROMPT()
            return { stop: true }
        }
    }

    mask = !mask || !unmask ? mask : run_combineMasks(graph, mask, unmask, `aNotB`)

    if (mask && maskForm.segmentIndex != null) {
        const segs = graph.MaskToSEGS({
            mask,
        })

        const segsFilter = graph.ImpactSEGSOrderedFilter({
            segs,
            target: `area(=w*h)`,
            take_start: maskForm.segmentIndex,
        })

        mask = graph.SegsToCombinedMask({ segs: segsFilter.outputs.filtered_SEGS })
    }

    if (mask && maskForm.samDetectorThreshold != null) {
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
            detection_hint: `center-1`,
            mask_hint_use_negative: `False`,
        }).outputs.combined_mask
    }

    if (mask && maskForm.erodeOrDilate !== 0) {
        mask =
            maskForm.erodeOrDilate > 0
                ? graph.Mask_Dilate_Region({ masks: mask, iterations: maskForm.erodeOrDilate })
                : maskForm.erodeOrDilate < 0
                ? graph.Mask_Erode_Region({ masks: mask, iterations: -maskForm.erodeOrDilate })
                : mask
    }

    if (maskForm.preview) {
        if (!mask) {
            flow.print(`No Mask Defined`)
            return { stop: true }
        }
        const maskAsImage = graph.MaskToImage({ mask })
        const maskPreview = graph.ImageBlend({
            image1: maskAsImage,
            image2: image,
            blend_mode: `normal`,
            blend_factor: 0.5,
        })
        graph.PreviewImage({ images: maskPreview })
        await flow.PROMPT()
        return { stop: true }
    }

    return { mask, stop: false }
}
