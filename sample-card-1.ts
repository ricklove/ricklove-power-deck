import { FormBuilder, Widget_group, Widget_group_output, Widget_inlineRun, Widget_list_output } from 'src'
import { ComfyWorkflowBuilder } from 'src/back/NodeBuilder'

const ui_maskItemPrompt = (
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

const ui_maskPrompt = (form: FormBuilder, options: { defaultPrompt?: string } = {}) => {
    return form.group({
        layout: 'V',
        items: () => ({
            parts: form.list({
                element: () => ui_maskItemPrompt(form, options),
            }),
            segmentIndex: form.intOpt({ default: 0, min: 0, max: 10 }),
            preview: form.inlineRun({}),
        }),
    })
}

type MaskForm = ReturnType<typeof ui_maskPrompt>

const run_combineMasks = (graph: ComfyWorkflowBuilder, a: _MASK, b: _MASK, operation: `union` | `intersection` | `aNotB`) => {
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

const run_buildMasks = async (
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

app({
    ui: (form) => ({
        workingDirectory: form.str({}),
        startImage: form.image({}),
        _1: form.markdown({ markdown: `# Prepare Image` }),
        crop: ui_maskPrompt(form, { defaultPrompt: `person` }),
        mask: ui_maskPrompt(form, { defaultPrompt: `ball` }),
        _2: form.markdown({ markdown: `# Modify Image` }),
        // g: form.groupOpt({
        //     items: () => ({
        positive: form.str({}),
        //     }),
        // }),

        // testTimeline: form.timeline({
        //     width: 100,
        //     height: 100,
        //     element: () => ({
        //         item: form.str({ default: `ball` }),
        //     }),
        // }),
        // testRegional: form.regional({
        //     width: 100,
        //     height: 100,
        //     element: () => ({
        //         item: form.str({ default: `ball` }),
        //     }),
        // }),
    }),
    run: async (flow, form) => {
        flow.print(`${JSON.stringify(form)}`)

        // Build a ComfyUI graph
        const graph = flow.nodes

        // load, crop, and resize image
        const startImage = await flow.loadImageAnswer(form.startImage)

        const { mask: cropMask, stop: stopAtCrop } = await run_buildMasks(flow, graph, startImage, form.crop)
        if (stopAtCrop) {
            return
        }
        const { cropped_image } = !cropMask
            ? { cropped_image: startImage }
            : graph.RL$_Crop$_Resize({ image: startImage, mask: cropMask }).outputs

        const { mask, stop: stopAtMask } = await run_buildMasks(flow, graph, cropped_image, form.mask)
        if (stopAtMask) {
            return
        }

        const loraStack = graph.LoRA_Stacker({
            input_mode: `simple`,
            lora_count: 1,
            lora_name_1: `lcm-lora-sdxl.safetensors`,
        } as LoRA_Stacker_input)

        const loader = graph.Efficient_Loader({
            ckpt_name: `protovisionXLHighFidelity3D_beta0520Bakedvae.safetensors`,
            lora_stack: loraStack,
            // defaults
            lora_name: `None`,
            token_normalization: `none`,
            vae_name: `Baked VAE`,
            weight_interpretation: `comfy`,
            positive: form.positive,
            negative: ``,
        })

        const startLatent = (() => {
            const startLatent0 = graph.VAEEncode({ pixels: cropped_image, vae: loader })
            if (!mask) {
                return startLatent0
            }
            const startLatent1 = graph.SetLatentNoiseMask({ samples: startLatent0, mask })
            return startLatent1
        })()

        const seed = flow.randomSeed()
        const sampler = graph.KSampler_Adv$5_$1Efficient$2({
            add_noise: `disable`,
            return_with_leftover_noise: `disable`,
            vae_decode: `true`,
            preview_method: `auto`,
            noise_seed: seed,
            steps: 11,
            cfg: 1.5,
            sampler_name: 'lcm',
            scheduler: 'normal',
            start_at_step: 7,

            model: loader,
            positive: loader.outputs.CONDITIONING$6, //graph.CLIPTextEncode({ text: form.positive, clip: loader }),
            negative: loader.outputs.CONDITIONING$7, //graph.CLIPTextEncode({ text: form.positive, clip: loader }),
            // negative: graph.CLIPTextEncode({ text: '', clip: loader }),
            // latent_image: graph.EmptyLatentImage({ width: 512, height: 512, batch_size: 1 }),
            latent_image: startLatent,
        })

        graph.SaveImage({
            images: graph.VAEDecode({ samples: sampler, vae: loader }),
            filename_prefix: 'ComfyUI',
        })

        // Run the graph you built
        const result = await flow.PROMPT()

        // // Disable some nodes
        // const iDisableStart = flow.workflow.nodes.indexOf(loraStack) - 1
        // flow.workflow.nodes.slice(iDisableStart).forEach((x) => x.disable())

        // // Build new graph with part of old graph
        // graph.PreviewImage({ images: cropMask.outputs.Heatmap$_Mask })

        // // Run new graph
        // await flow.PROMPT()

        // result.delete();
        // result.

        // Undisable all nodes so they can be rendered in the graph view
        // flow.workflow.nodes.forEach((x) => (x.disabled = false));
    },
})

// card('demo1-basic', {
//     author: 'rvion',
//     ui: (form) => ({ positive: form.str({ label: 'Positive', default: 'flower' }), }),
//     run: async (action, form) => {
//         // Build a ComfyUI graph
//         const graph = action.nodes
//         const ckpt = graph.CheckpointLoaderSimple({ ckpt_name: 'albedobaseXL_v02.safetensors' })
//         const seed = action.randomSeed()
//         const sampler = graph.KSampler({
//             seed: seed,
//             steps: 20,
//             cfg: 14,
//             sampler_name: 'euler',
//             scheduler: 'normal',
//             denoise: 0.8,
//             model: ckpt,
//             positive: graph.CLIPTextEncode({ text: form.positive, clip: ckpt }),
//             negative: graph.CLIPTextEncode({ text: '', clip: ckpt }),
//             latent_image: graph.EmptyLatentImage({ width: 512, height: 512, batch_size: 1 }),
//         })

//         graph.SaveImage({
//             images: graph.VAEDecode({ samples: sampler, vae: ckpt }),
//             filename_prefix: 'ComfyUI',
//         })

//         // Run the graph you built
//         await action.PROMPT()
//     },
// })
