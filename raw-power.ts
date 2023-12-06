import { StopError, operation_mask } from './src/_maskPrefabs'
import { appOptimized, OptimizerComponent, OptimizerComponentViewState } from './src/optimizer'

appOptimized({
    ui: (form) => ({
        // workingDirectory: form.str({}),
        // startImage: form.image({}),
        imageSource: form.group({
            items: () => ({
                directory: form.string({}),
                // pattern: form.string({ default: `*.png` }),
                startIndex: form.int({ default: 0, min: 0 }),
                endIndex: form.intOpt({ default: 10000, min: 0, max: 10000 }),
                selectEveryNth: form.intOpt({ default: 1, min: 1 }),
                batchSize: form.int({ default: 1, min: 1 }),
                iterationCount: form.int({ default: 1, min: 1 }),
                iterationSize: form.intOpt({ default: 1, min: 1 }),
                preview: form.inlineRun({}),
            }),
        }),
        _1: form.markdown({
            markdown: () => `# Crop Image`,
        }),

        // crop1:
        cropMaskOperations: operation_mask.ui(form),
        cropPadding: form.int({ default: 64 }),
        size: form.choice({
            items: () => ({
                common: form.selectOne({
                    default: { id: `512` },
                    choices: [{ id: `384` }, { id: `512` }, { id: `768` }, { id: `1024` }, { id: `1280` }, { id: `1920` }],
                }),
                custom: form.number({ default: 512, min: 32, max: 8096 }),
            }),
        }),
        previewCrop: form.inlineRun({}),

        _2: form.markdown({
            markdown: () => `# Mask Replacement`,
        }),

        //operation_mask.ui(form).maskOperations,
        replaceMaskOperations: operation_mask.ui(form),
        // ...operation_replaceMask.ui(form),
        // mask: ui_maskPrompt(form, { defaultPrompt: `ball` }),

        _3: form.markdown({ markdown: (formRoot) => `# Generate Image` }),

        useImpaintingEncode: form.bool({ default: false }),
        previewLatent: form.inlineRun({}),

        // g: form.groupOpt({
        //     items: () => ({
        positive: form.str({}),
        negative: form.str({}),

        steps: form.int({ default: 11, min: 0, max: 100 }),
        startStep: form.intOpt({ default: 1, min: 0, max: 100 }),
        startStepFromEnd: form.intOpt({ default: 1, min: 0, max: 100 }),
        stepsToIterate: form.intOpt({ default: 2, min: 0, max: 100 }),
        endStep: form.intOpt({ default: 1000, min: 0, max: 100 }),
        endStepFromEnd: form.intOpt({ default: 0, min: 0, max: 100 }),

        checkpoint: form.enum({
            enumName: 'Enum_CheckpointLoaderSimple_ckpt_name',
            default: 'nightvisionXLPhotorealisticPortrait_release0770Bakedvae.safetensors',
        }),
        sdxl: form.bool({ default: true }),
        lcm: form.bool({ default: true }),
        controlNet: form.list({
            element: () =>
                form.group({
                    items: () => ({
                        controlNet: form.enum({
                            enumName: 'Enum_ControlNetLoader_control_net_name',
                            default: 'sdxl-depth-mid.safetensors',
                        }),
                        // preprocessor: form.enum({
                        //     enumName: 'Enum_OpenposePreprocessor_detect_body',
                        //     default: 'sdxl-depth-mid.safetensors',
                        // }),
                        strength: form.float({ default: 1, min: 0, max: 1, step: 0.01 }),
                        start: form.float({ default: 0, min: 0, max: 1, step: 0.01 }),
                        end: form.float({ default: 0, min: 0, max: 1, step: 0.01 }),
                        preview: form.inlineRun({}),
                    }),
                }),
        }),
        config: form.float({ default: 1.5 }),
        add_noise: form.bool({ default: true }),

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

        const iterate = async (batchIndex: number) => {
            flow.print(`${JSON.stringify(form)}`)

            // Build a ComfyUI graph
            const graph = flow.nodes
            const state = { flow, graph, scopeStack: [{}] }

            // load, crop, and resize image
            // const startImageRaw = await flow.loadImageAnswer(form.startImage)
            // const startImage = graph.AlphaChanelRemove({ images: startImageRaw })

            const startImageBatch = graph.VHS$_LoadImagesPath({
                directory: form.imageSource.directory,
                image_load_cap: form.imageSource.batchSize,
                skip_first_images:
                    form.imageSource.startIndex +
                    batchIndex *
                        (form.imageSource.iterationSize ?? form.imageSource.batchSize) *
                        (form.imageSource.selectEveryNth ?? 1),
                select_every_nth: form.imageSource.selectEveryNth ?? 1,
            }).outputs.IMAGE

            if (form.imageSource.preview) {
                graph.PreviewImage({ images: startImageBatch })
                await flow.PROMPT()
                throw new StopError()
            }

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

            const cropMaskBatch = await operation_mask.run(state, startImageBatch, undefined, form.cropMaskOperations)

            const { size: sizeInput, cropPadding } = form
            const size = typeof sizeInput === `number` ? sizeInput : Number(sizeInput.id)
            const croppedImageBatch = !cropMaskBatch
                ? startImageBatch
                : graph.RL$_Crop$_Resize({
                      image: startImageBatch,
                      mask: cropMaskBatch,
                      max_side_length: size,
                      padding: cropPadding,
                  }).outputs.cropped_image

            if (form.previewCrop) {
                graph.PreviewImage({ images: startImageBatch })
                if (cropMaskBatch) {
                    const maskImage = graph.MaskToImage({ mask: cropMaskBatch })
                    graph.PreviewImage({ images: maskImage })
                }
                graph.PreviewImage({ images: croppedImageBatch })
                await flow.PROMPT()
                throw new StopError()
            }

            const replaceMaskBatch = await operation_mask.run(state, croppedImageBatch, undefined, form.replaceMaskOperations)

            const loraStack = !form.lcm
                ? undefined
                : graph.LoRA_Stacker({
                      input_mode: `simple`,
                      lora_count: 1,
                      lora_name_1: !form.sdxl ? `lcm-lora-sd.safetensors` : `lcm-lora-sdxl.safetensors`,
                  } as LoRA_Stacker_input)

            let controlNetStack = undefined as undefined | Control_Net_Stacker
            for (const c of form.controlNet) {
                const imagePre = c.controlNet.toLowerCase().includes(`depth`)
                    ? graph.Zoe$7DepthMapPreprocessor({ image: croppedImageBatch })
                    : c.controlNet.toLowerCase().includes(`normal`)
                    ? graph.BAE$7NormalMapPreprocessor({ image: croppedImageBatch })
                    : croppedImageBatch

                if (c.preview) {
                    graph.PreviewImage({ images: imagePre })
                    await flow.PROMPT()
                    throw new StopError()
                }

                controlNetStack = graph.Control_Net_Stacker({
                    cnet_stack: controlNetStack,
                    control_net: graph.ControlNetLoader({ control_net_name: c.controlNet }),
                    image: imagePre,
                    strength: c.strength,
                    start_percent: c.start,
                    end_percent: c.end,
                })
            }

            const loader = graph.Efficient_Loader({
                ckpt_name: form.checkpoint,
                lora_stack: loraStack,
                cnet_stack: controlNetStack,
                // defaults
                lora_name: `None`,
                token_normalization: `none`,
                vae_name: `Baked VAE`,
                weight_interpretation: `comfy`,
                positive: form.positive,
                negative: form.negative,
            })

            const startLatent = (() => {
                if (replaceMaskBatch && form.useImpaintingEncode) {
                    const imageList = graph.ImpactImageBatchToImageList({
                        image: croppedImageBatch,
                    })

                    let maskList = graph.MasksToMaskList({
                        masks: replaceMaskBatch,
                    }).outputs.MASK as _MASK
                    const latentList = graph.VAEEncodeForInpaint({ pixels: imageList, vae: loader, mask: maskList })

                    return graph.RebatchLatents({
                        latents: latentList,
                    })
                }

                const startLatent0 = graph.VAEEncode({ pixels: croppedImageBatch, vae: loader })
                if (!replaceMaskBatch) {
                    return startLatent0
                }
                const startLatent1 = graph.SetLatentNoiseMask({ samples: startLatent0, mask: replaceMaskBatch })
                return startLatent1
            })()

            let latent = startLatent._LATENT
            // latent = graph.LatentUpscaleBy({ samples: latent, scale_by: 1.1, upscale_method: `bicubic` }).outputs.LATENT
            // latent = graph.LatentCrop({ samples: latent, width: 1024, height: 1024, x: width* }).outputs.LATENT

            if (form.previewLatent) {
                if (replaceMaskBatch) {
                    const maskImage = graph.MaskToImage({ mask: replaceMaskBatch })
                    graph.PreviewImage({ images: maskImage })
                }

                const latentImage = graph.VAEDecode({ samples: latent, vae: loader.outputs.VAE })
                graph.PreviewImage({ images: latentImage })
                await flow.PROMPT()
                throw new StopError()
            }

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
        }

        for (let i = 0; i < form.imageSource.iterationCount; i++) {
            try {
                await iterate(i)
            } catch (err) {
                if (err instanceof StopError) {
                    return
                }

                throw err
            }
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
