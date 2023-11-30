import { FormBuilder, Widget_group, Widget_group_output, Widget_inlineRun, Widget_list_output } from 'src'
import { ComfyWorkflowBuilder } from 'src/back/NodeBuilder'
import { StopError, operation_mask } from './src/_maskPrefabs'

app({
    ui: (form) => ({
        workingDirectory: form.str({}),

        startImage: form.image({}),
        _1: form.markdown({ markdown: `# Prepare Image` }),
        // crop1:
        cropMaskOperations: operation_mask.ui(form),
        //operation_mask.ui(form).maskOperations,
        replaceMaskOperations: operation_mask.ui(form),
        // ...operation_replaceMask.ui(form),
        // mask: ui_maskPrompt(form, { defaultPrompt: `ball` }),
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
        try {
            flow.print(`${JSON.stringify(form)}`)

            // Build a ComfyUI graph
            const graph = flow.nodes
            const state = { flow, graph, scopeStack: [{}] }

            // load, crop, and resize image
            const startImage = await flow.loadImageAnswer(form.startImage)

            const cropMask = await operation_mask.run(state, startImage, undefined, form.cropMaskOperations)

            const { cropped_image } = !cropMask
                ? { cropped_image: startImage }
                : graph.RL$_Crop$_Resize({ image: startImage, mask: cropMask }).outputs

            const mask = await operation_mask.run(state, cropped_image, undefined, form.replaceMaskOperations)

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
                start_at_step: 0,

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
        } catch (err) {
            if (err instanceof StopError) {
                return
            }

            throw err
        }
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
