import { ComfyNode } from 'src/core/ComfyNode'
import { AppState, PreviewStopError, disableNodesAfterInclusive } from './src/_appState'
import { cacheImage, cacheMask } from './src/_cache'
import { showLoadingMessage } from './src/_loadingMessage'
import { operation_mask } from './src/_maskPrefabs'
import { appOptimized, OptimizerComponent, OptimizerComponentViewState } from './src/optimizer'
import { ComfyWorkflowBuilder } from 'src/back/NodeBuilder'
import { ComfyNodeOutput } from 'src/core/Slot'
import { StepDefinition, createStepsSystem } from './src/_steps'
import { Image } from 'konva/lib/shapes/Image'
import { createRandomGenerator } from './src/_random'
import { operation_image } from './src/_imageOperations'
import { imageOperationsList } from './src/_operations/image'
import { allOperationsList } from './src/_operations/allOperations'
import { createFrameIdProvider } from './src/_operations/_frame'

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

        testAllOperationsList: allOperationsList.ui(form),
        preview_testAllOperationsList: form.inlineRun({}),

        _1: form.markdown({
            markdown: () => `# Crop Image`,
        }),

        // crop1:
        cropPreImageOperations: operation_image.ui(form),
        previewCropPreImage: form.inlineRun({}),

        cropMaskOperations: operation_mask.ui(form),
        cropPadding: form.int({ default: 64 }),
        size: form.choice({
            items: () => ({
                common: form.selectOne({
                    default: { id: `512` },
                    choices: [{ id: `384` }, { id: `512` }, { id: `768` }, { id: `1024` }, { id: `1280` }, { id: `1920` }],
                }),
                custom: form.int({ default: 512, min: 32, max: 8096 }),
            }),
        }),
        sizeWidth: form.intOpt({ default: 512, min: 32, max: 8096 }),
        sizeHeight: form.intOpt({ default: 512, min: 32, max: 8096 }),

        previewCropMask: form.inlineRun({}),
        previewCrop: form.inlineRun({}),

        _2: form.markdown({
            markdown: () => `# Mask Replacement`,
        }),

        //operation_mask.ui(form).maskOperations,
        replacePreImageOperations: operation_image.ui(form),
        previewReplacePreImage: form.inlineRun({}),
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
                sideFrameDoubleBackIterations: form.intOpt({ default: 1 }),
                preview: form.inlineRun({}),
            }),
        }),

        upscale: form.groupOpt({
            items: () => ({
                upscaleBy: form.float({ default: 2, min: 0, max: 10 }),
                steps: form.int({ default: 20, min: 0, max: 100 }),
                denoise: form.float({ default: 0.4, min: 0, max: 1, step: 0.01 }),
                tileStrength: form.float({ default: 1.0, min: 0, max: 1 }),
                sdxl: form.bool({ default: false }),
                lcm: form.bool({ default: true }),
                // mask: form.bool({ default: true }),
                config: form.float({ default: 7, min: 0, max: 20 }),
                checkpoint: form.enum({
                    enumName: 'Enum_CheckpointLoaderSimple_ckpt_name',
                    default: 'realisticVisionV51_v51VAE-inpainting.safetensors',
                }),
                preview: form.inlineRun({}),
            }),
        }),

        uncrop: form.groupOpt({
            items: () => ({
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
        try {
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
                comfyUiInputRelativePath: `../comfyui/ComfyUI/input`,
                graph: runtime.nodes,
                scopeStack: [{}],
            })

            // steps

            const startImageStep = defineStep({
                name: `startImageStep`,
                preview: form.imageSource.preview,
                cacheParams: [],
                inputSteps: {},
                create: ({ graph, imageDirectory, workingDirectory }, {}) => {
                    const loadImageNode = graph.RL$_LoadImageSequence({
                        path: `${imageDirectory}/${form.imageSource.filePattern}`,
                        current_frame: 0,
                    })
                    const startImage = loadImageNode.outputs.image

                    const saveImageNode = graph.RL$_SaveImageSequence({
                        images: startImage,
                        current_frame: 0,
                        path: `../input/${workingDirectory}/_start-image/#####.png`,
                    })

                    return {
                        nodes: { loadImageNode, saveImageNode },
                        outputs: { startImage },
                    }
                },
                modify: ({ nodes, frameIndex }) => {
                    nodes.loadImageNode.inputs.current_frame = frameIndex
                    nodes.saveImageNode.inputs.current_frame = frameIndex
                },
            })

            const testAllOperationsListStep = defineStep({
                name: `testAllOperationsListStep`,
                preview: form.preview_testAllOperationsList,
                cacheParams: [form.testAllOperationsList],
                inputSteps: { startImageStep },
                create: (state, { inputs }) => {
                    const { startImage } = inputs
                    const imageSize = state.graph.Get_image_size({ image: startImage })
                    const fullMask = state.graph.SolidMask({
                        width: imageSize.outputs.INT,
                        height: imageSize.outputs.INT_1,
                        value: 0xffffff,
                    })
                    const frameIdProvider = createFrameIdProvider()
                    const result = allOperationsList.run(
                        {
                            ...state,
                        },
                        form.testAllOperationsList,
                        {
                            image: startImage,
                            mask: fullMask,
                            frameIdProvider: frameIdProvider,
                        },
                    )
                    return {
                        nodes: { frameIdProvider },
                        outputs: { image_testAllOperationsList: result.image, mask_testAllOperationsList: result.mask },
                    }
                },
                modify: ({ nodes, frameIndex }) => {
                    nodes.frameIdProvider.set(frameIndex)
                },
            })

            const cropPreImageStep = defineStep({
                name: `cropPreImageStep`,
                preview: form.previewCropPreImage,
                cacheParams: [form.cropPreImageOperations],
                inputSteps: { startImageStep },
                create: (state, { inputs }) => {
                    const { startImage } = inputs
                    const cropPreImage = operation_image.run(state, startImage, form.cropPreImageOperations)
                    return {
                        nodes: {},
                        outputs: { cropPreImage },
                    }
                },
                modify: ({ nodes, frameIndex }) => {
                    // nothing specific to the frameIndex
                },
            })

            const cropMaskStep = defineStep({
                name: `cropMaskStep`,
                preview: form.previewCropMask,
                cacheParams: [form.cropMaskOperations],
                inputSteps: { cropPreImageStep },
                create: (state, { inputs }) => {
                    const { cropPreImage } = inputs
                    const cropMask = operation_mask.run(state, cropPreImage, undefined, form.cropMaskOperations)
                    return {
                        nodes: {},
                        outputs: { cropMask },
                    }
                },
                modify: ({ nodes, frameIndex }) => {
                    // nothing specific to the frameIndex
                },
            })

            // TODO: Interpolate the crop masks to smooth frame to frame jerking

            const cropStep = defineStep({
                name: `cropStep`,
                preview: form.previewCrop,
                cacheParams: [form.size, form.cropPadding, form.sizeWidth, form.sizeHeight],
                inputSteps: { startImageStep, cropMaskStep },
                create: ({ graph, workingDirectory }, { inputs }) => {
                    const { startImage, cropMask } = inputs

                    const { size: sizeInput, cropPadding, sizeWidth, sizeHeight } = form
                    const size = sizeInput.custom ?? Number(sizeInput.common?.id)
                    const startImageSize = graph.Get_Image_Size({
                        image: startImage,
                    })

                    const {
                        cropped_image: croppedImage,
                        left_source,
                        right_source,
                        top_source,
                        bottom_source,
                    } = !cropMask
                        ? {
                              cropped_image: startImage,
                              left_source: 0,
                              right_source: startImageSize.outputs.INT,
                              top_source: 0,
                              bottom_source: startImageSize.outputs.INT_1,
                          }
                        : graph.RL$_Crop$_Resize({
                              image: startImage,
                              mask: cropMask,
                              max_side_length: size,
                              width: sizeWidth ?? undefined,
                              height: sizeHeight ?? undefined,
                              padding: cropPadding,
                          }).outputs

                    const blackImage = graph.EmptyImage({
                        color: 0,
                        width: startImageSize.outputs.INT,
                        height: startImageSize.outputs.INT_1,
                        batch_size: 1,
                    })
                    const whiteImage = graph.EmptyImage({
                        color: 0xffffff,
                        width: startImageSize.outputs.INT,
                        height: startImageSize.outputs.INT_1,
                        batch_size: 1,
                    })
                    const cropAreaImage = graph.Image_Paste_Crop_by_Location({
                        image: blackImage,
                        crop_image: whiteImage,
                        crop_blending: 0,
                        left: left_source,
                        right: right_source,
                        top: top_source,
                        bottom: bottom_source,
                    }).outputs.IMAGE

                    const saveCropAreaImageNode = graph.RL$_SaveImageSequence({
                        images: cropAreaImage,
                        current_frame: 0,
                        path: `../input/${workingDirectory}/_crop-area/#####.png`,
                    })
                    return {
                        nodes: { saveCropAreaImageNode },
                        outputs: { croppedImage },
                    }
                },
                modify: ({ nodes, frameIndex }) => {
                    nodes.saveCropAreaImageNode.inputs.current_frame = frameIndex
                },
            })

            const replacePreImageStep = defineStep({
                name: `replacePreImageStep`,
                preview: form.previewReplacePreImage,
                cacheParams: [form.replacePreImageOperations],
                inputSteps: { cropStep },
                create: (state, { inputs }) => {
                    const { croppedImage } = inputs
                    const replacePreImage = operation_image.run(state, croppedImage, form.replacePreImageOperations)
                    return {
                        nodes: {},
                        outputs: { replacePreImage },
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
                inputSteps: { replacePreImageStep },
                create: (state, { inputs }) => {
                    const { replacePreImage } = inputs
                    const replaceMask = operation_mask.run(state, replacePreImage, undefined, form.replaceMaskOperations)

                    const s = state.graph.Get_image_size({
                        image: replacePreImage,
                    })
                    const solidMask = state.graph.SolidMask({
                        value: 1,
                        width: s.outputs.INT,
                        height: s.outputs.INT_1,
                    })
                    const replaceMaskImage = state.graph.MaskToImage({
                        mask: replaceMask ?? solidMask,
                    })

                    const saveReplaceMaskImageNode = state.graph.RL$_SaveImageSequence({
                        images: replaceMaskImage,
                        current_frame: 0,
                        path: `../input/${state.workingDirectory}/_replace-mask/#####.png`,
                    })
                    return {
                        nodes: {
                            saveReplaceMaskImageNode,
                        },
                        outputs: { replaceMask },
                    }
                },
                modify: ({ nodes, frameIndex }) => {
                    nodes.saveReplaceMaskImageNode.inputs.current_frame = frameIndex
                },
            })

            const controlNetStackStep = (() => {
                let controlNetStepPrev = undefined as undefined | StepDefinition<{}, {}, { controlNetStack: CONTROL_NET_STACK }>
                for (const c of form.controlNet) {
                    const preprocessorKind = c.controlNet.toLowerCase().includes(`depth`)
                        ? `zoe-depth`
                        : c.controlNet.toLowerCase().includes(`normal`)
                        ? `bae-normal`
                        : c.controlNet.toLowerCase().includes(`sketch`) || c.controlNet.toLowerCase().includes(`canny`)
                        ? `hed`
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
                                    : preprocessorKind === `hed`
                                    ? graph.HEDPreprocessor({ image: croppedImage, safe: `enable`, version: `v1.1` }).outputs
                                          .IMAGE
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
                            throw new PreviewStopError(undefined)
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
                            throw new PreviewStopError(undefined)
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

            let finalStep = samplerSteps[0]

            if (form.film?.singleFramePyramidSize) {
                const { singleFramePyramidSize } = form.film
                finalStep = defineStep({
                    name: `filmStep`,
                    preview: form.film.preview,
                    cacheParams: [singleFramePyramidSize],
                    inputSteps: { samplerSteps },
                    create: (state, { inputs }) => {
                        // const { croppedImage } = inputs
                        const finalImages = samplerSteps
                            .map((x) => (() => x._build?.outputs.finalImage) as _IMAGE)
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

                            const filmframes_removedFirst = graph.ImageBatchRemove({
                                images: filmFrames,
                                index: 1,
                            })
                            oddFrames = graph.VHS$_SelectEveryNthImage({
                                images: filmframes_removedFirst,
                                select_every_nth: 2,
                            }).outputs.IMAGE
                        }

                        const interpolatedFrame = oddFrames

                        return {
                            nodes: {},
                            outputs: { finalImage: interpolatedFrame, interpolatedFrame },
                        }
                    },
                    modify: ({ nodes, frameIndex }) => {
                        // nothing specific to the frameIndex
                    },
                }) as unknown as typeof finalStep
            }

            defineStep({
                name: `finalSave`,
                // preview: form.film.preview,
                cacheParams: [],
                inputSteps: { finalStep },
                create: (state, { inputs }) => {
                    const { finalImage } = inputs
                    const { graph } = state

                    const saveImageNode = graph.RL$_SaveImageSequence({
                        images: finalImage,
                        current_frame: 0,
                        path: `../input/${state.workingDirectory}/_final/#####.png`,
                    })

                    return {
                        nodes: { saveImageNode },
                        outputs: { finalSavedImage: finalImage },
                    }
                },
                modify: ({ nodes, frameIndex }) => {
                    // nothing specific to the frameIndex
                    console.log(`finalSave: modify`, { frameIndex })
                    nodes.saveImageNode.inputs.current_frame = frameIndex
                },
            })

            // testing steps
            const frameIndexes = [...new Array(form.imageSource.iterationCount)].map((_, i) => ({
                frameIndex: form.imageSource.startIndex + i * (form.imageSource.selectEveryNth ?? 1),
            }))
            let dependecyKeyRef = await runSteps(frameIndexes.map((x) => x.frameIndex))

            if (form.film?.sideFrameDoubleBackIterations) {
                const { sideFrameDoubleBackIterations } = form.film
                console.log(`sideFrameDoubleBack START`)
                disableNodesAfterInclusive(runtime, 0)

                // new steps system
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

                const minCurrentFrame = Math.min(...frameIndexes.map((x) => x.frameIndex))
                const maxCurrentFrame = Math.max(...frameIndexes.map((x) => x.frameIndex))
                const size = 5
                const sizeHalf = (size / 2) | 0
                defineStep({
                    name: `sideFrameDoubleBack`,
                    // preview: form.film.preview,
                    cacheParams: [sideFrameDoubleBackIterations, size, dependecyKeyRef.dependencyKey],
                    inputSteps: {},
                    create: (state, { inputs }) => {
                        const { graph } = state

                        const loadImageBatchNode = graph.RL$_LoadImageSequence({
                            path: `${state.workingDirectory}/_final/#####.png`,
                            current_frame: 0,
                            count: size,
                        })

                        const filmModel = graph.Load_Film_Model_$1mtb$2({
                            film_model: `Style`,
                        })

                        let currentImages = loadImageBatchNode.outputs.image

                        for (let i = 0; i < sideFrameDoubleBackIterations; i++) {
                            const filmFrames = graph.Film_Interpolation_$1mtb$2({
                                film_model: filmModel,
                                images: currentImages,
                                interpolate: 1,
                            })
                            const filmframes_removedFirst = graph.ImageBatchRemove({
                                images: filmFrames,
                                index: 1,
                            })
                            const middleFrames = graph.VHS$_SelectEveryNthImage({
                                images: filmframes_removedFirst,
                                select_every_nth: 2,
                            })
                            const middleFrames_withFirst = graph.ImageBatchJoin({
                                images_a: graph.ImageBatchGet({
                                    images: filmFrames,
                                    index: 1,
                                }),
                                images_b: middleFrames,
                            })
                            const middleFrames_withFirstAndLast = graph.ImageBatchJoin({
                                images_a: middleFrames_withFirst,
                                images_b: graph.ImageBatchGet({
                                    images: filmFrames,
                                    index: graph.ImpactImageInfo({
                                        value: filmFrames,
                                    }).outputs.batch,
                                }),
                            })
                            const filmFrames2 = graph.Film_Interpolation_$1mtb$2({
                                film_model: filmModel,
                                images: middleFrames_withFirstAndLast,
                                interpolate: 1,
                            })
                            const filmframes2_removedFirst = graph.ImageBatchRemove({
                                images: filmFrames2,
                                index: 1,
                            })
                            const middleFrames2 = graph.VHS$_SelectEveryNthImage({
                                images: filmframes2_removedFirst,
                                select_every_nth: 2,
                            })
                            currentImages = middleFrames2.outputs.IMAGE
                        }

                        graph.SaveImage({
                            images: currentImages,
                            filename_prefix: `film`,
                        })

                        const mainImageNode = graph.ImageBatchGet({
                            images: currentImages,
                            index: sizeHalf + 1,
                        })
                        const mainImage = mainImageNode.outputs.IMAGE

                        const saveImageNode = graph.RL$_SaveImageSequence({
                            images: mainImage,
                            current_frame: 0,
                            path: `../input/${state.workingDirectory}/_final-film/#####.png`,
                        })

                        return {
                            nodes: { loadImageBatchNode, mainImageNode, saveImageNode },
                            outputs: { mainImage },
                        }
                    },
                    modify: ({ nodes, frameIndex }) => {
                        const cStart = Math.max(minCurrentFrame, frameIndex - sizeHalf)
                        const cEnd = Math.min(maxCurrentFrame, frameIndex + sizeHalf)
                        const cCount = cEnd - cStart + 1

                        nodes.loadImageBatchNode.inputs.current_frame = cStart
                        nodes.loadImageBatchNode.inputs.count = cCount
                        nodes.mainImageNode.inputs.index = frameIndex - cStart + 1 // 1-based

                        nodes.saveImageNode.inputs.current_frame = frameIndex
                    },
                })
                dependecyKeyRef = await runSteps(frameIndexes.map((x) => x.frameIndex))
            }

            if (form.upscale) {
                const formUpscale = form.upscale
                console.log(`upscale START`)
                disableNodesAfterInclusive(runtime, 0)

                const finalDir = form.film?.sideFrameDoubleBackIterations ? `_final-film` : `_final`

                // new steps system
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
                defineStep({
                    name: `upscale`,
                    preview: formUpscale.preview,
                    cacheParams: [formUpscale, dependecyKeyRef.dependencyKey],
                    inputSteps: {},
                    create: (state, { inputs }) => {
                        const { graph } = state

                        const loadImageNode = graph.RL$_LoadImageSequence({
                            path: `${state.workingDirectory}/${finalDir}/#####.png`,
                            current_frame: 0,
                        })

                        // TODO: crop to mask, restore unmasked
                        // const cropToMask = graph.RL$_Crop$_Resize({
                        //     image: loadImageNode,
                        //     mask:
                        // })

                        const controlNetStack = formUpscale.sdxl
                            ? undefined
                            : graph.Control_Net_Stacker({
                                  control_net: graph.ControlNetLoader({
                                      control_net_name: `control_v11f1e_sd15_tile.pth`,
                                  }),
                                  image: loadImageNode,
                                  strength: formUpscale.tileStrength,
                              })

                        const loraStack = !formUpscale.lcm
                            ? undefined
                            : graph.LoRA_Stacker({
                                  input_mode: `simple`,
                                  lora_count: 1,
                                  lora_name_1: !formUpscale.sdxl ? `lcm-lora-sd.safetensors` : `lcm-lora-sdxl.safetensors`,
                              } as LoRA_Stacker_input)

                        const loader = graph.Efficient_Loader({
                            ckpt_name: formUpscale.checkpoint,
                            cnet_stack: controlNetStack,
                            lora_stack: loraStack,
                            // defaults
                            lora_name: `None`,
                            token_normalization: `none`,
                            vae_name: `Baked VAE`,
                            weight_interpretation: `comfy`,
                            positive: form.sampler.positive,
                            negative: form.sampler.negative,
                        })

                        const upscaleNode = graph.UltimateSDUpscale({
                            image: loadImageNode,
                            force_uniform_tiles: `enable`,
                            mode_type: `Linear`,
                            seam_fix_mode: `None`,

                            model: loader,
                            vae: loader,
                            positive: loader.outputs.CONDITIONING$6,
                            negative: loader.outputs.CONDITIONING$7,
                            upscale_model: graph.UpscaleModelLoader({
                                model_name: `8x_NMKD-Superscale_150000_G.pth`,
                            }),
                            sampler_name: formUpscale.lcm ? `lcm` : `dpmpp_2m_sde_gpu`,
                            scheduler: formUpscale.lcm ? `normal` : `karras`,
                            denoise: formUpscale.denoise,
                            cfg: formUpscale.config,
                            seed: form.sampler.seed,
                            tile_width: formUpscale.sdxl ? (form.sizeWidth ?? 1024) * formUpscale.upscaleBy : 576,
                            tile_height: formUpscale.sdxl ? (form.sizeHeight ?? 1024) * formUpscale.upscaleBy : 768,
                            steps: formUpscale.steps,
                            // tile_width: 1536,
                            // tile_height: 2048,

                            upscale_by: formUpscale.upscaleBy,
                        })
                        const upscaledImage = upscaleNode.outputs.IMAGE

                        graph.SaveImage({
                            images: upscaledImage,
                            filename_prefix: `upscale`,
                        })

                        const saveImageNode = graph.RL$_SaveImageSequence({
                            images: upscaledImage,
                            current_frame: 0,
                            path: `../input/${state.workingDirectory}/_final-upscale/#####.png`,
                        })

                        return {
                            nodes: { loadImageNode, saveImageNode },
                            outputs: { upscaledImage },
                        }
                    },
                    modify: ({ nodes, frameIndex }) => {
                        nodes.loadImageNode.inputs.current_frame = frameIndex
                        nodes.saveImageNode.inputs.current_frame = frameIndex
                    },
                })
                dependecyKeyRef = await runSteps(frameIndexes.map((x) => x.frameIndex))
            }

            if (form.uncrop) {
                const formUncrop = form.uncrop
                console.log(`uncrop START`)
                disableNodesAfterInclusive(runtime, 0)

                const startDir = `_start-image`
                const finalDir = form.upscale
                    ? `_final-upscale`
                    : form.film?.sideFrameDoubleBackIterations
                    ? `_final-film`
                    : `_final`
                const cropAreaDir = `_crop-area`
                const replaceMaskDir = `_replace-mask`

                // new steps system
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
                defineStep({
                    name: `upscale`,
                    preview: formUncrop.preview,
                    cacheParams: [formUncrop, dependecyKeyRef.dependencyKey],
                    inputSteps: {},
                    create: (state, { inputs }) => {
                        const { graph } = state

                        const loadStartImageNode = graph.RL$_LoadImageSequence({
                            path: `${state.workingDirectory}/${startDir}/#####.png`,
                            current_frame: 0,
                        })
                        const loadFinalImageNode = graph.RL$_LoadImageSequence({
                            path: `${state.workingDirectory}/${finalDir}/#####.png`,
                            current_frame: 0,
                        })
                        const loadCropAreaImageNode = graph.RL$_LoadImageSequence({
                            path: `${state.workingDirectory}/${cropAreaDir}/#####.png`,
                            current_frame: 0,
                        })
                        const loadReplaceMaskImageNode = graph.RL$_LoadImageSequence({
                            path: `${state.workingDirectory}/${replaceMaskDir}/#####.png`,
                            current_frame: 0,
                        })

                        const uncroppedReplaceMaskImage = graph.Paste_By_Mask({
                            image_base: loadCropAreaImageNode,
                            image_to_paste: loadReplaceMaskImageNode,
                            mask: loadCropAreaImageNode,
                            resize_behavior: `resize`,
                        }).outputs.IMAGE

                        const uncroppedFinalImage = graph.Paste_By_Mask({
                            image_base: loadStartImageNode,
                            image_to_paste: loadFinalImageNode,
                            mask: loadCropAreaImageNode,
                            resize_behavior: `resize`,
                        }).outputs.IMAGE

                        const restoredImage = graph.Image_Blend_by_Mask({
                            image_a: loadStartImageNode,
                            image_b: uncroppedFinalImage,
                            mask: uncroppedReplaceMaskImage,
                            blend_percentage: 1,
                        }).outputs.IMAGE

                        // const uncroppedImage = graph.Paste_By_Mask({
                        //     image_base: loadStartImageNode,
                        //     image_to_paste: loadFinalImageNode,
                        //     mask: uncroppedReplaceMaskImage,
                        //     resize_behavior: `resize`,
                        // })

                        // graph.Paste_By_Mask({
                        //     image_base: loadStartImageNode,
                        //     image_to_paste: loadFinalImageNode,
                        //     mask:
                        // })

                        // graph.RL$_Uncrop({
                        //     image: loadStartImageNode,
                        //     cropped_image: loadFinalImageNode,
                        //     box:
                        // })

                        const uncroppedImage = restoredImage

                        graph.SaveImage({
                            images: uncroppedImage,
                            filename_prefix: `uncropped`,
                        })

                        return {
                            nodes: { loadStartImageNode, loadFinalImageNode, loadCropAreaImageNode, loadReplaceMaskImageNode },
                            outputs: { uncroppedImage, uncroppedReplaceMaskImage, uncroppedFinalImage },
                        }
                    },
                    modify: ({ nodes, frameIndex }) => {
                        nodes.loadStartImageNode.inputs.current_frame = frameIndex
                        nodes.loadFinalImageNode.inputs.current_frame = frameIndex
                        nodes.loadCropAreaImageNode.inputs.current_frame = frameIndex
                        nodes.loadReplaceMaskImageNode.inputs.current_frame = frameIndex
                    },
                })
                dependecyKeyRef = await runSteps(frameIndexes.map((x) => x.frameIndex))
            }

            return
        } catch (err) {
            if (err instanceof PreviewStopError) {
                await runtime.PROMPT()
                return
            }

            throw err
        }
    },
})
