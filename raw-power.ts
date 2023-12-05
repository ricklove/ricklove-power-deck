import { StopError, operation_mask } from './src/_maskPrefabs'
import { appOptimized, OptimizerComponent, OptimizerComponentViewState } from './src/optimizer'

appOptimized({
    ui: (form) => ({
        workingDirectory: form.str({}),

        startImage: form.image({}),
        _1: form.markdown({
            markdown: () => `# Prepare Image`,
        }),

        // crop1:
        cropMaskOperations: operation_mask.ui(form),
        cropPadding: form.int({ default: 64 }),
        //operation_mask.ui(form).maskOperations,
        replaceMaskOperations: operation_mask.ui(form),
        // ...operation_replaceMask.ui(form),
        // mask: ui_maskPrompt(form, { defaultPrompt: `ball` }),
        _2: form.markdown({ markdown: (formRoot) => `# Modify Image` }),
        // g: form.groupOpt({
        //     items: () => ({
        positive: form.str({}),
        size: form.choice({
            items: () => ({
                common: form.selectOne({
                    default: { id: `512` },
                    choices: [{ id: `384` }, { id: `512` }, { id: `768` }, { id: `1024` }, { id: `1280` }, { id: `1920` }],
                }),
                custom: form.number({ default: 512, min: 32, max: 8096 }),
            }),
        }),

        steps: form.int({ default: 11, min: 0, max: 100 }),
        startStep: form.intOpt({ default: 1, min: 0, max: 100 }),
        startStepFromEnd: form.intOpt({ default: 1, min: 0, max: 100 }),
        stepsToIterate: form.intOpt({ default: 2, min: 0, max: 100 }),
        endStep: form.intOpt({ default: 1000, min: 0, max: 100 }),
        endStepFromEnd: form.intOpt({ default: 0, min: 0, max: 100 }),
        config: form.float({ default: 1.5 }),
        add_noise: form.bool({ default: true }),
        useImpaintingModel: form.bool({ default: false }),
        useImpaintingEncode: form.bool({ default: false }),

        render: form.inlineRun({}),

        testSeed: form.seed({}),
        test: form.custom({
            Component: OptimizerComponent,
            defaultValue: () => ({} as OptimizerComponentViewState),
        }),
    }),
    run: async (flow, form) => {
        // flow.formSerial.test.value.
        // flow.formSerial.testSeed.val = 10
        // flow.formInstance.state.values.testSeed.state.val

        try {
            flow.print(`${JSON.stringify(form)}`)

            // Build a ComfyUI graph
            const graph = flow.nodes
            const state = { flow, graph, scopeStack: [{}] }

            // load, crop, and resize image
            const startImageRaw = await flow.loadImageAnswer(form.startImage)
            const startImage = graph.AlphaChanelRemove({ images: startImageRaw })

            // graph.CropImage$_AS({

            // })

            // const resizeImage = await graph.Image_Resize({
            //     image: startImage,
            //     mode:`resize`,
            //     resampling:`lanczos`,
            //     supersample: `false`,
            //     resize_width: width,
            //     resize_height: height,
            // });

            // const resizedImage = await graph.ImageTransformResizeClip({
            //     images: Image,
            //     method:`lanczos`,
            //     max_width: width,
            //     max_height: height,
            // });

            const cropMask = await operation_mask.run(state, startImage, undefined, form.cropMaskOperations)

            const { size: sizeInput, cropPadding } = form
            const size = typeof sizeInput === `number` ? sizeInput : Number(sizeInput.id)
            const { cropped_image } = !cropMask
                ? { cropped_image: startImage }
                : graph.RL$_Crop$_Resize({ image: startImage, mask: cropMask, max_side_length: size, padding: cropPadding })
                      .outputs

            // TODO: move replaceMask before crop so it is built on original pixels
            const replaceMask = await operation_mask.run(state, cropped_image, undefined, form.replaceMaskOperations)

            const loraStack = graph.LoRA_Stacker({
                input_mode: `simple`,
                lora_count: 1,
                lora_name_1: form.useImpaintingModel ? `lcm-lora-sd.safetensors` : `lcm-lora-sdxl.safetensors`,
            } as LoRA_Stacker_input)

            const loader = graph.Efficient_Loader({
                ckpt_name: form.useImpaintingModel
                    ? `realisticVisionV51_v51VAE-inpainting.safetensors`
                    : `protovisionXLHighFidelity3D_beta0520Bakedvae.safetensors`,
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
                if (replaceMask && form.useImpaintingEncode) {
                    return graph.VAEEncodeForInpaint({ pixels: cropped_image, vae: loader, mask: replaceMask })
                }

                const startLatent0 = graph.VAEEncode({ pixels: cropped_image, vae: loader })
                if (!replaceMask) {
                    return startLatent0
                }
                const startLatent1 = graph.SetLatentNoiseMask({ samples: startLatent0, mask: replaceMask })
                return startLatent1
            })()

            let latent = startLatent._LATENT
            // latent = graph.LatentUpscaleBy({ samples: latent, scale_by: 1.1, upscale_method: `bicubic` }).outputs.LATENT
            // latent = graph.LatentCrop({ samples: latent, width: 1024, height: 1024, x: width* }).outputs.LATENT

            const seed = flow.randomSeed()
            const startStep = Math.max(
                0,
                Math.min(
                    form.steps - 1,
                    form.startStep ? form.startStep : form.startStepFromEnd ? form.steps - form.startStepFromEnd : 0,
                ),
            )
            const endStep = Math.max(
                1,
                Math.min(
                    form.steps,
                    form.endStep
                        ? form.endStep
                        : form.endStepFromEnd
                        ? form.steps - form.endStepFromEnd
                        : form.stepsToIterate
                        ? startStep + form.stepsToIterate
                        : form.steps,
                ),
            )
            const sampler = graph.KSampler_Adv$5_$1Efficient$2({
                add_noise: form.add_noise ? `enable` : `disable`,
                return_with_leftover_noise: `disable`,
                vae_decode: `true`,
                preview_method: `auto`,
                noise_seed: seed,
                steps: form.steps,
                start_at_step: startStep,
                end_at_step: endStep,

                cfg: form.config,
                sampler_name: 'lcm',
                scheduler: 'normal',

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

            // Add optimized value
            // addOptimizerResult({ path: flow.lastImage?.filename ?? `` }, stepsCount, flow.formSerial.steps)

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
