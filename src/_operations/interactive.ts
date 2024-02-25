import { createImageOperation } from './_frame'

const interactiveMask = createImageOperation({
    ui: (form) => ({
        // imageMask: form.image({}),
        erodeCenter: form.int({ default: 0, max: 126 }),
    }),
    run: (state, form, frame) => {
        const { runtime, graph } = state
        const { image, mask } = frame

        // const resultMask = graph.ImageToMask({
        //     image: state.runtime.loadImageAnswer2(form.imageMask)
        // })
        let resultMask = mask
        if (form.erodeCenter) {
            const maskCenter = graph.Mask_Erode_Region({
                iterations: 64 - Math.max(0, Math.min(63, form.erodeCenter - 63)),
                masks: graph.Mask_Erode_Region({
                    iterations: 64 - Math.max(0, Math.min(63, form.erodeCenter)),
                    masks: mask,
                }),
            })
            const missingCenter = graph.Image_To_Mask({
                method: `intensity`,
                image: graph.Combine_Masks({
                    op: `intersection (min)`,
                    clamp_result: `yes`,
                    round_result: `no`,
                    image1: graph.MaskToImage({ mask: graph.InvertMask({ mask: maskCenter }) }),
                    image2: graph.MaskToImage({ mask }),
                }),
            })
            resultMask = missingCenter.outputs.MASK

            // graph.PreviewImage({
            //     images: graph.ImageBatch({
            //         image1: graph.MaskToImage({ mask: missingCenter.outputs.MASK }),
            //         image2: graph.ImageBlend({
            //             blend_mode: `normal`,
            //             blend_factor: 0.5,
            //             image1: image,
            //             image2: graph.MaskToImage({ mask: missingCenter.outputs.MASK }),
            //         }),
            //     }),
            // })
        }

        return { mask: resultMask }
    },
})

export const interactiveOperations = {
    interactiveMask,
}
