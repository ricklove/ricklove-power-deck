import { ComfyNode } from 'src/core/ComfyNode'
import { AppState, StopError, disableNodesAfterInclusive } from './src/_appState'
import { cacheImage, cacheMask } from './src/_cache'
import { showLoadingMessage } from './src/_loadingMessage'
import { operation_mask } from './src/_maskPrefabs'
import { appOptimized, OptimizerComponent, OptimizerComponentViewState } from './src/optimizer'
import { ComfyWorkflowBuilder } from 'src/back/NodeBuilder'
import { ComfyNodeOutput } from 'src/core/Slot'
import { StepDefinition, createStepsSystem } from './src/_steps'

appOptimized({
    ui: (form) => ({
        // workingDirectory: form.str({}),
        // startImage: form.image({}),
        imageSource: form.group({
            items: () => ({
                directory: form.string({ default: `video` }),
                filePattern: form.string({ default: `#####.png` }),
                // pattern: form.string({ default: `*.png` }),
                startIndex: form.int({ default: 0, min: 0 }),
                endIndex: form.intOpt({ default: 10000, min: 0, max: 10000 }),
                selectEveryNth: form.intOpt({ default: 1, min: 1 }),
                // batchSize: form.int({ default: 1, min: 1 }),
                iterationCount: form.int({ default: 1, min: 1 }),
                // iterationSize: form.intOpt({ default: 1, min: 1 }),
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

        previewCropMask: form.inlineRun({}),
        previewCrop: form.inlineRun({}),

        _2: form.markdown({
            markdown: () => `# Mask Replacement`,
        }),

        //operation_mask.ui(form).maskOperations,
        replaceMaskOperations: operation_mask.ui(form),
        previewReplaceMask: form.inlineRun({}),
        // ...operation_replaceMask.ui(form),
        // mask: ui_maskPrompt(form, { defaultPrompt: `ball` }),

        _3: form.markdown({ markdown: (formRoot) => `# Generate Image` }),

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

        sampler: form.group({
            items: () => ({
                previewInputs: form.inlineRun({}),

                useImpaintingEncode: form.bool({ default: false }),
                previewLatent: form.inlineRun({}),

                // g: form.groupOpt({
                //     items: () => ({
                positive: form.str({}),
                negative: form.str({}),

                seed: form.seed({}),

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
                config: form.float({ default: 1.5 }),
                add_noise: form.bool({ default: true }),

                preview: form.inlineRun({}),
            }),
        }),

        film: form.groupOpt({
            items: () => ({
                singleFramePyramidSize: form.intOpt({ default: 4 }),
                // sideFrameDoubleBack: form.bool({}),
                preview: form.inlineRun({}),
            }),
        }),

        testSeed: form.seed({}),
        test: form.custom({
            Component: OptimizerComponent,
            defaultValue: () => ({} as OptimizerComponentViewState),
        }),
    }),
    run: async (runtime, form) => {
        // flow.formSerial.test.value.
        // flow.formSerial.testSeed.val = 10
        // flow.formInstance.state.values.testSeed.state.val
        const _imageDirectory = form.imageSource.directory.replace(/\/$/g, ``)
        const {
            defineStep,
            runSteps,
            state: _state,
        } = createStepsSystem({
            runtime: runtime,
            imageDirectory: form.imageSource.directory.replace(/\/$/g, ``),
            graph: runtime.nodes,
            scopeStack: [{}],
        })

        // steps
        const startImageStep = defineStep({
            name: `startImageStep`,
            preview: form.imageSource.preview,
            cacheParams: [],
            inputSteps: {},
            create: ({ graph, imageDirectory }) => {
                const loadImageNode = graph.RL$_LoadImageSequence({
                    path: `${imageDirectory}/${form.imageSource.filePattern}`,
                    current_frame: 0,
                })
                const startImage = loadImageNode.outputs.image

                return {
                    nodes: { loadImageNode },
                    outputs: { startImage },
                }
            },
            modify: ({ nodes, frameIndex }) => {
                nodes.loadImageNode.inputs.current_frame = frameIndex
            },
        })

        const cropMaskStep = defineStep({
            name: `cropMaskStep`,
            preview: form.previewCropMask,
            cacheParams: [form.cropMaskOperations],
            inputSteps: { startImageStep },
            create: (state, { inputs }) => {
                const { startImage } = inputs
                const cropMask = operation_mask.run(state, startImage, undefined, form.cropMaskOperations)
                return {
                    nodes: {},
                    outputs: { cropMask },
                }
            },
            modify: ({ nodes, frameIndex }) => {
                // nothing specific to the frameIndex
            },
        })

        const cropStep = defineStep({
            name: `cropStep`,
            preview: form.previewCrop,
            cacheParams: [form.size, form.cropPadding],
            inputSteps: { startImageStep, cropMaskStep },
            create: ({ graph }, { inputs }) => {
                const { startImage, cropMask } = inputs

                const { size: sizeInput, cropPadding } = form
                const size = typeof sizeInput === `number` ? sizeInput : Number(sizeInput.id)
                const croppedImage = !cropMask
                    ? startImage
                    : graph.RL$_Crop$_Resize({
                          image: startImage,
                          mask: cropMask,
                          max_side_length: size,
                          padding: cropPadding,
                      }).outputs.cropped_image

                return {
                    nodes: {},
                    outputs: { croppedImage },
                }
            },
            modify: ({ nodes, frameIndex }) => {
                // nothing specific to the frameIndex
            },
        })

        const replaceMaskStep = defineStep({
            name: `replaceMaskStep`,
            preview: form.previewReplaceMask,
            cacheParams: [form.replaceMaskOperations],
            inputSteps: { cropStep },
            create: (state, { inputs }) => {
                const { croppedImage } = inputs
                const replaceMask = operation_mask.run(state, croppedImage, undefined, form.replaceMaskOperations)
                return {
                    nodes: {},
                    outputs: { replaceMask },
                }
            },
            modify: ({ nodes, frameIndex }) => {
                // nothing specific to the frameIndex
            },
        })

        const controlNetStackStep = (() => {
            let controlNetStepPrev = undefined as undefined | StepDefinition<{}, {}, { controlNetStack: CONTROL_NET_STACK }>
            for (const c of form.controlNet) {
                const preprocessorKind = c.controlNet.toLowerCase().includes(`depth`)
                    ? `zoe-depth`
                    : c.controlNet.toLowerCase().includes(`normal`)
                    ? `bae-normal`
                    : undefined

                const preprocessorStep = defineStep({
                    name: `preprocessorStep`,
                    preview: c.preview,
                    cacheParams: [preprocessorKind],
                    inputSteps: { cropStep },
                    create: ({ graph }, { inputs }) => {
                        const { croppedImage } = inputs

                        const imagePre =
                            preprocessorKind === `zoe-depth`
                                ? graph.Zoe$7DepthMapPreprocessor({ image: croppedImage }).outputs.IMAGE
                                : preprocessorKind === `bae-normal`
                                ? graph.BAE$7NormalMapPreprocessor({ image: croppedImage }).outputs.IMAGE
                                : croppedImage

                        return {
                            nodes: {},
                            outputs: { imagePre },
                        }
                    },
                    modify: ({ nodes, frameIndex }) => {
                        // nothing specific to the frameIndex
                    },
                })

                const controlNetStep = defineStep({
                    name: `controlNetStep`,
                    preview: c.preview,
                    cacheParams: [],
                    inputSteps: { preprocessorStep, controlNetStepPrev },
                    create: ({ graph }, { inputs }) => {
                        const { imagePre, controlNetStack: controlNetStackPrev } = inputs
                        console.log(`controlNetStep:`, { imagePre, controlNetStackPrev })

                        const controlNetStack = graph.Control_Net_Stacker({
                            cnet_stack: controlNetStackPrev,
                            control_net: graph.ControlNetLoader({ control_net_name: c.controlNet }),
                            image: imagePre,
                            strength: c.strength,
                            start_percent: c.start,
                            end_percent: c.end,
                        }).outputs.CNET_STACK

                        return {
                            nodes: {},
                            outputs: { controlNetStack },
                        }
                    },
                    modify: ({ nodes, frameIndex }) => {
                        // nothing specific to the frameIndex
                    },
                })
                controlNetStepPrev = controlNetStep as unknown as typeof controlNetStepPrev
            }

            return controlNetStepPrev
        })()

        const samplerStep_create = (iRepeat: number) =>
            defineStep({
                name: `samplerStep`,
                preview: form.sampler.preview,
                cacheParams: [form.sampler, iRepeat],
                inputSteps: { cropStep, replaceMaskStep, controlNetStackStep },
                create: ({ graph }, { inputs }) => {
                    const { croppedImage, replaceMask, controlNetStack } = inputs

                    if (form.sampler.previewInputs) {
                        graph.PreviewImage({ images: croppedImage })
                        if (replaceMask) {
                            const maskImage = graph.MaskToImage({ mask: replaceMask })
                            graph.PreviewImage({ images: maskImage })
                        }
                        throw new StopError(undefined)
                    }

                    const loraStack = !form.sampler.lcm
                        ? undefined
                        : graph.LoRA_Stacker({
                              input_mode: `simple`,
                              lora_count: 1,
                              lora_name_1: !form.sampler.sdxl ? `lcm-lora-sd.safetensors` : `lcm-lora-sdxl.safetensors`,
                          } as LoRA_Stacker_input)

                    const loader = graph.Efficient_Loader({
                        ckpt_name: form.sampler.checkpoint,
                        lora_stack: loraStack,
                        cnet_stack: controlNetStack,
                        // defaults
                        lora_name: `None`,
                        token_normalization: `none`,
                        vae_name: `Baked VAE`,
                        weight_interpretation: `comfy`,
                        positive: form.sampler.positive,
                        negative: form.sampler.negative,
                    })

                    const startLatent = (() => {
                        if (replaceMask && form.sampler.useImpaintingEncode) {
                            const imageList = graph.ImpactImageBatchToImageList({
                                image: croppedImage,
                            })

                            let maskList = graph.MasksToMaskList({
                                masks: replaceMask,
                            }).outputs.MASK as _MASK
                            const latentList = graph.VAEEncodeForInpaint({ pixels: imageList, vae: loader, mask: maskList })

                            return graph.RebatchLatents({
                                latents: latentList,
                            })
                        }

                        const startLatent0 = graph.VAEEncode({ pixels: croppedImage, vae: loader })
                        if (!replaceMask) {
                            return startLatent0
                        }
                        const startLatent1 = graph.SetLatentNoiseMask({ samples: startLatent0, mask: replaceMask })
                        return startLatent1
                    })()

                    let latent = startLatent._LATENT
                    // latent = graph.LatentUpscaleBy({ samples: latent, scale_by: 1.1, upscale_method: `bicubic` }).outputs.LATENT
                    // latent = graph.LatentCrop({ samples: latent, width: 1024, height: 1024, x: width* }).outputs.LATENT

                    if (form.sampler.previewLatent) {
                        if (replaceMask) {
                            const maskImage = graph.MaskToImage({ mask: replaceMask })
                            graph.PreviewImage({ images: maskImage })
                        }

                        const latentImage = graph.VAEDecode({ samples: latent, vae: loader.outputs.VAE })
                        graph.PreviewImage({ images: latentImage })
                        throw new StopError(undefined)
                    }

                    // if (form.film?.singleFramePyramidSize) {
                    //     latent = graph.RepeatLatentBatch({
                    //         samples: latent,
                    //         amount: form.film.singleFramePyramidSize,
                    //     }).outputs.LATENT
                    // }

                    const startStep = Math.max(
                        0,
                        Math.min(
                            form.sampler.steps - 1,
                            form.sampler.startStep
                                ? form.sampler.startStep
                                : form.sampler.startStepFromEnd
                                ? form.sampler.steps - form.sampler.startStepFromEnd
                                : 0,
                        ),
                    )
                    const endStep = Math.max(
                        1,
                        Math.min(
                            form.sampler.steps,
                            form.sampler.endStep
                                ? form.sampler.endStep
                                : form.sampler.endStepFromEnd
                                ? form.sampler.steps - form.sampler.endStepFromEnd
                                : form.sampler.stepsToIterate
                                ? startStep + form.sampler.stepsToIterate
                                : form.sampler.steps,
                        ),
                    )
                    const seed = form.sampler.seed
                    const sampler = graph.KSampler_Adv$5_$1Efficient$2({
                        add_noise: form.sampler.add_noise ? `enable` : `disable`,
                        return_with_leftover_noise: `disable`,
                        vae_decode: `true`,
                        preview_method: `auto`,
                        noise_seed: seed + iRepeat,
                        steps: form.sampler.steps,
                        start_at_step: startStep,
                        end_at_step: endStep,

                        cfg: form.sampler.config,
                        sampler_name: 'lcm',
                        scheduler: 'normal',

                        model: loader,
                        positive: loader.outputs.CONDITIONING$6, //graph.CLIPTextEncode({ text: form.sampler.positive, clip: loader }),
                        negative: loader.outputs.CONDITIONING$7, //graph.CLIPTextEncode({ text: form.sampler.positive, clip: loader }),
                        // negative: graph.CLIPTextEncode({ text: '', clip: loader }),
                        // latent_image: graph.EmptyLatentImage({ width: 512, height: 512, batch_size: 1 }),
                        latent_image: startLatent,
                    })

                    const finalImage = graph.VAEDecode({ samples: sampler, vae: loader }).outputs.IMAGE

                    graph.SaveImage({
                        images: finalImage,
                        filename_prefix: 'cushy',
                    })

                    graph.PreviewImage({
                        images: finalImage,
                    })

                    return {
                        nodes: {},
                        outputs: { finalImage: finalImage },
                    }
                },
                modify: ({ nodes, frameIndex }) => {
                    // nothing specific to the frameIndex
                },
            })

        const samplerSteps = [...new Array(form.film?.singleFramePyramidSize ?? 1)].map((_, i) => samplerStep_create(i))

        if (form.film?.singleFramePyramidSize) {
            const { singleFramePyramidSize } = form.film
            const filmStep = defineStep({
                name: `filmStep`,
                preview: form.film.preview,
                cacheParams: [singleFramePyramidSize],
                inputSteps: { samplerSteps },
                create: (state, { inputs }) => {
                    // const { croppedImage } = inputs
                    const finalImages = samplerSteps
                        .map((x) => x._build?.outputs.finalImage)
                        .filter((x) => x)
                        .map((x) => x!)
                    const { graph } = state

                    let images = finalImages[0] as _IMAGE
                    for (const f of finalImages.slice(1)) {
                        images = graph.ImageBatch({
                            image1: images,
                            image2: f,
                        }).outputs.IMAGE
                    }

                    const filmModel = graph.Load_Film_Model_$1mtb$2({
                        film_model: `Style`,
                    })

                    let oddFrames = images
                    for (let iLayer = 0; iLayer < singleFramePyramidSize - 1; iLayer++) {
                        const filmFrames = graph.Film_Interpolation_$1mtb$2({
                            film_model: filmModel,
                            images: oddFrames,
                            interpolate: 1,
                        })

                        graph.SaveImage({
                            images: filmFrames,
                            filename_prefix: `film`,
                        })

                        oddFrames = graph.ImageBatchFork({
                            images: filmFrames,
                            priority: `first`,
                        }).outputs.IMAGE_1
                    }

                    const interpolatedFrame = oddFrames

                    return {
                        nodes: {},
                        outputs: { interpolatedFrame },
                    }
                },
                modify: ({ nodes, frameIndex }) => {
                    // nothing specific to the frameIndex
                },
            })
        }

        // testing steps
        const frameIndexes = [...new Array(form.imageSource.iterationCount)].map((_, i) => ({
            frameIndex: form.imageSource.startIndex + i * (form.imageSource.selectEveryNth ?? 1),
        }))
        await runSteps(frameIndexes.map((x) => x.frameIndex))
        return

        // old
        const iterate = async (iterationIndex: number) => {
            runtime.print(`${JSON.stringify(form)}`)
            const dependencyKeyRef = { dependencyKey: `` }

            // Build a ComfyUI graph
            const state = _state
            const { imageDirectory, graph } = state
            state.scopeStack = [{}]

            const frameIndex = form.imageSource.startIndex + iterationIndex * (form.imageSource.selectEveryNth ?? 1)
            const startImage = graph.RL$_LoadImageSequence({
                path: `${imageDirectory}/${form.imageSource.filePattern}`,
                current_frame: frameIndex,
            }).outputs.image

            if (form.imageSource.preview) {
                graph.PreviewImage({ images: startImage })
                throw new StopError(undefined)
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

            const { mask: cropMask } = await cacheMask(
                state,
                `cropMask`,
                frameIndex,
                form.cropMaskOperations,
                dependencyKeyRef,
                async () => operation_mask.run(state, startImage, undefined, form.cropMaskOperations),
            )

            if (form.previewCropMask) {
                graph.PreviewImage({ images: startImage })
                if (cropMask) {
                    const maskImage = graph.MaskToImage({ mask: cropMask })
                    graph.PreviewImage({ images: maskImage })
                }
                throw new StopError(undefined)
            }

            const { size: sizeInput, cropPadding } = form
            const size = typeof sizeInput === `number` ? sizeInput : Number(sizeInput.id)
            const { image: croppedImage } = !cropMask
                ? { image: startImage }
                : await cacheImage(
                      state,
                      `croppedImage`,
                      frameIndex,
                      { size, cropPadding },
                      dependencyKeyRef,
                      async () =>
                          graph.RL$_Crop$_Resize({
                              image: startImage,
                              mask: cropMask,
                              max_side_length: size,
                              padding: cropPadding,
                          }).outputs.cropped_image,
                  )

            if (form.previewCrop) {
                graph.PreviewImage({ images: startImage })
                if (cropMask) {
                    const maskImage = graph.MaskToImage({ mask: cropMask })
                    graph.PreviewImage({ images: maskImage })
                }
                graph.PreviewImage({ images: croppedImage })
                throw new StopError(undefined)
            }

            const { mask: replaceMask } = await cacheMask(
                state,
                `replaceMask`,
                frameIndex,
                form.replaceMaskOperations,
                dependencyKeyRef,
                async () => await operation_mask.run(state, croppedImage, undefined, form.replaceMaskOperations),
            )

            let controlNetStack = undefined as undefined | Control_Net_Stacker
            for (const c of form.controlNet) {
                const preprocessorKind = c.controlNet.toLowerCase().includes(`depth`)
                    ? `zoe-depth`
                    : c.controlNet.toLowerCase().includes(`normal`)
                    ? `bae-normal`
                    : undefined

                const { image: imagePre } = !preprocessorKind
                    ? { image: croppedImage }
                    : await cacheImage(state, `preprocessor`, frameIndex, { preprocessorKind }, dependencyKeyRef, async () =>
                          preprocessorKind === `zoe-depth`
                              ? graph.Zoe$7DepthMapPreprocessor({ image: croppedImage })
                              : preprocessorKind === `bae-normal`
                              ? graph.BAE$7NormalMapPreprocessor({ image: croppedImage })
                              : croppedImage,
                      )

                if (c.preview) {
                    graph.PreviewImage({ images: imagePre })
                    throw new StopError(undefined)
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

            const loraStack = !form.sampler.lcm
                ? undefined
                : graph.LoRA_Stacker({
                      input_mode: `simple`,
                      lora_count: 1,
                      lora_name_1: !form.sampler.sdxl ? `lcm-lora-sd.safetensors` : `lcm-lora-sdxl.safetensors`,
                  } as LoRA_Stacker_input)

            const loader = graph.Efficient_Loader({
                ckpt_name: form.sampler.checkpoint,
                lora_stack: loraStack,
                cnet_stack: controlNetStack,
                // defaults
                lora_name: `None`,
                token_normalization: `none`,
                vae_name: `Baked VAE`,
                weight_interpretation: `comfy`,
                positive: form.sampler.positive,
                negative: form.sampler.negative,
            })

            const startLatent = (() => {
                if (replaceMask && form.sampler.useImpaintingEncode) {
                    const imageList = graph.ImpactImageBatchToImageList({
                        image: croppedImage,
                    })

                    let maskList = graph.MasksToMaskList({
                        masks: replaceMask,
                    }).outputs.MASK as _MASK
                    const latentList = graph.VAEEncodeForInpaint({ pixels: imageList, vae: loader, mask: maskList })

                    return graph.RebatchLatents({
                        latents: latentList,
                    })
                }

                const startLatent0 = graph.VAEEncode({ pixels: croppedImage, vae: loader })
                if (!replaceMask) {
                    return startLatent0
                }
                const startLatent1 = graph.SetLatentNoiseMask({ samples: startLatent0, mask: replaceMask })
                return startLatent1
            })()

            let latent = startLatent._LATENT
            // latent = graph.LatentUpscaleBy({ samples: latent, scale_by: 1.1, upscale_method: `bicubic` }).outputs.LATENT
            // latent = graph.LatentCrop({ samples: latent, width: 1024, height: 1024, x: width* }).outputs.LATENT

            if (form.sampler.previewLatent) {
                if (replaceMask) {
                    const maskImage = graph.MaskToImage({ mask: replaceMask })
                    graph.PreviewImage({ images: maskImage })
                }

                const latentImage = graph.VAEDecode({ samples: latent, vae: loader.outputs.VAE })
                graph.PreviewImage({ images: latentImage })
                throw new StopError(undefined)
            }

            const seed = form.sampler.seed
            const startStep = Math.max(
                0,
                Math.min(
                    form.sampler.steps - 1,
                    form.sampler.startStep
                        ? form.sampler.startStep
                        : form.sampler.startStepFromEnd
                        ? form.sampler.steps - form.sampler.startStepFromEnd
                        : 0,
                ),
            )
            const endStep = Math.max(
                1,
                Math.min(
                    form.sampler.steps,
                    form.sampler.endStep
                        ? form.sampler.endStep
                        : form.sampler.endStepFromEnd
                        ? form.sampler.steps - form.sampler.endStepFromEnd
                        : form.sampler.stepsToIterate
                        ? startStep + form.sampler.stepsToIterate
                        : form.sampler.steps,
                ),
            )
            const sampler = graph.KSampler_Adv$5_$1Efficient$2({
                add_noise: form.sampler.add_noise ? `enable` : `disable`,
                return_with_leftover_noise: `disable`,
                vae_decode: `true`,
                preview_method: `auto`,
                noise_seed: seed,
                steps: form.sampler.steps,
                start_at_step: startStep,
                end_at_step: endStep,

                cfg: form.sampler.config,
                sampler_name: 'lcm',
                scheduler: 'normal',

                model: loader,
                positive: loader.outputs.CONDITIONING$6, //graph.CLIPTextEncode({ text: form.sampler.positive, clip: loader }),
                negative: loader.outputs.CONDITIONING$7, //graph.CLIPTextEncode({ text: form.sampler.positive, clip: loader }),
                // negative: graph.CLIPTextEncode({ text: '', clip: loader }),
                // latent_image: graph.EmptyLatentImage({ width: 512, height: 512, batch_size: 1 }),
                latent_image: startLatent,
            })

            graph.SaveImage({
                images: graph.VAEDecode({ samples: sampler, vae: loader }),
                filename_prefix: 'ComfyUI',
            })

            // Run the graph you built
            const result = await runtime.PROMPT()

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
            const loadingMain = showLoadingMessage(runtime, `iteration: ${i}`)

            try {
                await iterate(i)
                loadingMain.delete()
                disableNodesAfterInclusive(runtime, 0)
            } catch (err) {
                if (!(err instanceof StopError)) {
                    throw err
                }

                await runtime.PROMPT()
                loadingMain.delete()
                // return
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
