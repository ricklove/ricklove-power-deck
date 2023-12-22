import { ComfyWorkflowBuilder } from 'src/back/NodeBuilder'
import { PreviewStopError, loadFromScope, storeInScope } from '../_appState'
import { createFrameOperation } from './_frame'

const clipSeg = createFrameOperation({
    ui: (form) => ({
        prompt: form.str({ default: `ball` }),
        threshold: form.float({ default: 0.4, min: 0, max: 1, step: 0.01 }),
        dilation: form.int({ default: 4, min: 0 }),
        blur: form.float({ default: 1, min: 0 }),
    }),
    run: ({ runtime, graph }, form, { image, mask }) => {
        const resultMask = graph.CLIPSeg({
            image: image,
            text: form.prompt,
            threshold: form.threshold,
            dilation_factor: form.dilation,
            blur: form.blur,
        }).outputs.Mask

        return { mask: resultMask }
    },
})

const imageToMask = createFrameOperation({
    ui: (form) => ({}),
    run: ({ runtime, graph }, form, { image, mask }) => {
        const imageMask = graph.Image_To_Mask({
            image: image,
            method: `intensity`,
        })

        return { mask: imageMask }
    },
})

const maskToImage = createFrameOperation({
    ui: (form) => ({}),
    run: ({ runtime, graph }, form, { image, mask }) => {
        const maskImage = graph.MaskToImage({
            mask: mask,
        })

        return { image: maskImage }
    },
})

const erodeOrDilate = createFrameOperation({
    ui: (form) => ({
        erodeOrDilate: form.int({ min: -64, max: 64 }),
    }),
    run: ({ runtime, graph }, form, { image, mask }) => {
        const resultMask =
            form.erodeOrDilate > 0
                ? graph.Mask_Dilate_Region({ masks: mask, iterations: form.erodeOrDilate }).outputs.MASKS
                : form.erodeOrDilate < 0
                ? graph.Mask_Erode_Region({ masks: mask, iterations: -form.erodeOrDilate }).outputs.MASKS
                : mask
        return { mask: resultMask }
    },
})

const segment = createFrameOperation({
    ui: (form) => ({
        keepIndex: form.int({ default: 0, min: 0, max: 10 }),
        keepCount: form.int({ default: 1, min: 1, max: 10 }),
    }),
    run: ({ runtime, graph }, form, { image, mask }) => {
        const segs = graph.MaskToSEGS({
            mask,
        })

        const segsFilter = graph.ImpactSEGSOrderedFilter({
            segs,
            target: `area(=w*h)`,
            take_start: form.keepIndex,
            take_count: form.keepCount,
        })

        const resultMask = graph.SegsToCombinedMask({ segs: segsFilter.outputs.filtered_SEGS }).outputs.MASK

        return { mask: resultMask }
    },
})

const sam = createFrameOperation({
    ui: (form) => ({
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
    run: ({ runtime, graph }, form, { image, mask }) => {
        const samModel = graph.SAMLoader({
            model_name: `sam_vit_b_01ec64.pth`,
            device_mode: `Prefer GPU`,
        })

        const segs = graph.MaskToSEGS({
            mask,
        })

        const resultMask = graph.SAMDetectorSegmented({
            segs,
            sam_model: samModel,
            image,
            detection_hint: form.detection_hint,
            mask_hint_use_negative: form.mask_hint_use_negative,
            threshold: form.threshold,
        }).outputs.combined_mask

        return { mask: resultMask }
    },
})

const combineMasks = createFrameOperation({
    options: {
        hideLoadVariables: true,
    },
    ui: (form) => ({
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
    run: (state, form, { image, mask }) => {
        const { graph } = state

        const getModifiedMask = (item: typeof form.a) => {
            const m = loadFromScope<_MASK>(state, item.name)
            if (!m) {
                return undefined
            }
            return !item.inverse ? m : graph.InvertMask({ mask: m })
        }

        let resultMask = getModifiedMask(form.a)
        const otherMasks = [form.b, form.c, form.d, form.e].filter((x) => x).map((x) => x!)

        for (const mItem of otherMasks) {
            const mMask = getModifiedMask(mItem)
            if (!mMask) {
                continue
            }
            if (!resultMask) {
                resultMask = mMask
                continue
            }
            resultMask = graph.ImageToMask$_AS({
                image: graph.Combine_Masks({
                    image1: graph.MaskToImage({ mask: resultMask }),
                    image2: graph.MaskToImage({ mask: mMask }),
                    op: form.operation.id === `union` ? `union (max)` : `intersection (min)`,
                    clamp_result: `yes`,
                    round_result: `no`,
                }).outputs.IMAGE,
            }).outputs.MASK
        }

        return { mask: resultMask }
    },
})

export const maskOperations = {
    imageToMask,
    maskToImage,
    clipSeg,
    segment,
    sam,
    erodeOrDilate,
    combineMasks,
}
