import { PreviewStopError, loadFromScope } from '../_appState'
import { createFrameOperation } from './_frame'
import { storageOperations } from './storage'
import { videoOperations } from './video'

const sampler = createFrameOperation({
    ui: (form) => ({
        useImpaintingEncode: form.bool({ default: false }),
        previewLatent: form.inlineRun({}),
        add_noise: form.bool({ default: true }),

        controlNet: form.list({
            element: () =>
                form.group({
                    items: () => ({
                        enabled: form.bool({ default: true }),
                        controlNet: form.enum({
                            enumName: 'Enum_ControlNetLoader_control_net_name',
                            default: 'sdxl-depth-mid.safetensors',
                        }),
                        strength: form.float({ default: 1, min: 0, max: 1, step: 0.01 }),
                        start: form.float({ default: 0, min: 0, max: 1, step: 0.01 }),
                        end: form.float({ default: 1, min: 0, max: 1, step: 0.01 }),
                        imageVariable: form.stringOpt({}),
                        preview: form.inlineRun({}),
                    }),
                }),
        }),

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
        sampler: form.enum({
            enumName: `Enum_KSampler_sampler_name`,
            default: `dpmpp_3m_sde_gpu`,
        }),
        scheduler: form.enum({
            enumName: `Enum_KSampler_scheduler`,
            default: `karras`,
        }),
        sdxl: form.bool({ default: true }),
        lcm: form.bool({ default: true }),
        lcmTurbo: form.bool({ default: true }),
        freeU: form.bool({ default: true }),
        config: form.float({ default: 1.5 }),
        batchSizeForPyramidReduce: form.int({ default: 1, min: 1, max: 16 }),
    }),
    run: (state, form, frame) => {
        const { runtime, graph } = state
        const { image, mask } = frame
        const startImage = image
        const replaceMask = mask

        let controlNetStack = undefined as undefined | CONTROL_NET_STACK
        for (const c of form.controlNet) {
            if (!c.enabled) {
                continue
            }

            const image = loadFromScope<_IMAGE>(state, c.imageVariable ?? ``) ?? startImage

            if (c.preview) {
                graph.PreviewImage({ images: image })
                throw new PreviewStopError(undefined)
            }

            controlNetStack = graph.Control_Net_Stacker({
                cnet_stack: controlNetStack,
                control_net: graph.ControlNetLoader({ control_net_name: c.controlNet }),
                image,
                strength: c.strength,
                start_percent: c.start,
                end_percent: c.end,
            }).outputs.CNET_STACK
        }

        const loraStack =
            form.lcmTurbo && form.sdxl
                ? graph.LoRA_Stacker({
                      input_mode: `simple`,
                      lora_count: 1,
                      lora_name_1: `LCMTurboMix_Euler_A_fix.safetensors`,
                  } as LoRA_Stacker_input).outputs.LORA_STACK
                : form.lcm
                ? graph.LoRA_Stacker({
                      input_mode: `simple`,
                      lora_count: 1,
                      lora_name_1: !form.sdxl ? `lcm-lora-sd.safetensors` : `lcm-lora-sdxl.safetensors`,
                  } as LoRA_Stacker_input).outputs.LORA_STACK
                : undefined

        const loader = graph.Efficient_Loader({
            ckpt_name: form.checkpoint,
            cnet_stack: controlNetStack,
            lora_stack: loraStack,

            // defaults
            lora_name: `None`,
            token_normalization: `none`,
            vae_name: `Baked VAE`,
            weight_interpretation: `comfy`,
            positive: form.positive,
            negative: form.negative,
        })

        const startLatent = (() => {
            if (replaceMask && form.useImpaintingEncode) {
                const imageList = graph.ImpactImageBatchToImageList({
                    image: startImage,
                })

                let maskList = graph.MasksToMaskList({
                    masks: replaceMask,
                }).outputs.MASK as _MASK
                const latentList = graph.VAEEncodeForInpaint({ pixels: imageList, vae: loader, mask: maskList })

                return graph.RebatchLatents({
                    latents: latentList,
                })
            }

            const startLatent0 = graph.VAEEncode({ pixels: startImage, vae: loader })
            if (!replaceMask) {
                return startLatent0
            }
            const startLatent1 = graph.SetLatentNoiseMask({ samples: startLatent0, mask: replaceMask })
            return startLatent1
        })()

        let latent = startLatent._LATENT
        // latent = graph.LatentUpscaleBy({ samples: latent, scale_by: 1.1, upscale_method: `bicubic` }).outputs.LATENT
        // latent = graph.LatentCrop({ samples: latent, width: 1024, height: 1024, x: width* }).outputs.LATENT

        if (form.previewLatent) {
            if (replaceMask) {
                const maskImage = graph.MaskToImage({ mask: replaceMask })
                graph.PreviewImage({ images: maskImage })
            }

            const latentImage = graph.VAEDecode({ samples: latent, vae: loader.outputs.VAE })
            graph.PreviewImage({ images: latentImage })
            throw new PreviewStopError(undefined)
        }

        if (form.batchSizeForPyramidReduce) {
            latent = graph.RepeatLatentBatch({
                samples: latent,
                amount: form.batchSizeForPyramidReduce,
            }).outputs.LATENT
        }

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
        const seed = form.seed
        const sampler = graph.KSampler_Adv$5_$1Efficient$2({
            add_noise: form.add_noise ? `enable` : `disable`,
            return_with_leftover_noise: `disable`,
            vae_decode: `false`,
            preview_method: `none`,
            noise_seed: seed,
            steps: form.steps,
            start_at_step: startStep,
            end_at_step: endStep,

            cfg: form.config,
            sampler_name: form.lcm || form.lcmTurbo ? 'lcm' : form.sampler,
            scheduler: form.lcm || form.lcmTurbo ? 'normal' : form.scheduler,

            model: form.freeU
                ? graph.FreeU({ model: loader.outputs.MODEL, b1: 1.2, b2: 1.2, s1: 1.1, s2: 0.2 }).outputs.MODEL
                : loader,
            positive: loader.outputs.CONDITIONING$6, //graph.CLIPTextEncode({ text: form.positive, clip: loader }),
            negative: loader.outputs.CONDITIONING$7, //graph.CLIPTextEncode({ text: form.positive, clip: loader }),
            // negative: graph.CLIPTextEncode({ text: '', clip: loader }),
            // latent_image: graph.EmptyLatentImage({ width: 512, height: 512, batch_size: 1 }),
            latent_image: latent,
        })

        // const finalImage = graph.VAEDecode({ samples: sampler, vae: loader }).outputs.IMAGE

        // return { image: finalImage }

        let batchImages = graph.VAEDecode({ samples: sampler, vae: loader }).outputs.IMAGE

        if (form.batchSizeForPyramidReduce <= 1) {
            return { image: batchImages }
        }

        return videoOperations.filmInterpolationPyramidReduceImageBatch.run(
            state,
            { imageBatchSize: form.batchSizeForPyramidReduce },
            { ...frame, image: batchImages },
        )
    },
})

const ultimateUpscale = createFrameOperation({
    ui: (form) => ({
        controlNet: form.list({
            element: () =>
                form.group({
                    items: () => ({
                        enabled: form.bool({ default: true }),
                        controlNet: form.enum({
                            enumName: 'Enum_ControlNetLoader_control_net_name',
                            default: 'control_v11f1e_sd15_tile.pth',
                        }),
                        strength: form.float({ default: 1, min: 0, max: 1, step: 0.01 }),
                        start: form.float({ default: 0, min: 0, max: 1, step: 0.01 }),
                        end: form.float({ default: 1, min: 0, max: 1, step: 0.01 }),
                        imageVariable: form.stringOpt({}),
                        preview: form.inlineRun({}),
                    }),
                }),
        }),

        positive: form.str({}),
        negative: form.str({}),

        seed: form.seed({}),
        steps: form.int({ default: 20 }),
        denoise: form.float({ default: 0.4, min: 0, max: 1, step: 0.01 }),

        // steps: form.int({ default: 11, min: 0, max: 100 }),
        // startStep: form.intOpt({ default: 1, min: 0, max: 100 }),
        // startStepFromEnd: form.intOpt({ default: 1, min: 0, max: 100 }),
        // stepsToIterate: form.intOpt({ default: 2, min: 0, max: 100 }),
        // endStep: form.intOpt({ default: 1000, min: 0, max: 100 }),
        // endStepFromEnd: form.intOpt({ default: 0, min: 0, max: 100 }),

        checkpoint: form.enum({
            enumName: 'Enum_CheckpointLoaderSimple_ckpt_name',
            default: 'realisticVisionV51_v51VAE-inpainting.safetensors',
        }),
        // sdxl: form.bool({ default: true }),
        lcm: form.bool({ default: true }),
        config: form.float({ default: 1.5 }),
    }),
    run: (state, form, frame) => {
        const { runtime, graph } = state
        const { image, mask } = frame
        const startImage = image
        const replaceMask = mask

        let controlNetStack = undefined as undefined | CONTROL_NET_STACK
        for (const c of form.controlNet) {
            if (!c.enabled) {
                continue
            }

            const image = loadFromScope<_IMAGE>(state, c.imageVariable ?? ``) ?? startImage

            if (c.preview) {
                graph.PreviewImage({ images: image })
                throw new PreviewStopError(undefined)
            }

            controlNetStack = graph.Control_Net_Stacker({
                cnet_stack: controlNetStack,
                control_net: graph.ControlNetLoader({ control_net_name: c.controlNet }),
                image,
                strength: c.strength,
                start_percent: c.start,
                end_percent: c.end,
            }).outputs.CNET_STACK
        }

        const loraStack = !form.lcm
            ? undefined
            : graph.LoRA_Stacker({
                  input_mode: `simple`,
                  lora_count: 1,
                  //   lora_name_1: !form.sdxl ? `lcm-lora-sd.safetensors` : `lcm-lora-sdxl.safetensors`,
                  lora_name_1: `lcm-lora-sd.safetensors`,
              } as LoRA_Stacker_input).outputs.LORA_STACK

        const loader = graph.Efficient_Loader({
            ckpt_name: form.checkpoint,
            cnet_stack: controlNetStack,
            lora_stack: loraStack,

            // defaults
            lora_name: `None`,
            token_normalization: `none`,
            vae_name: `Baked VAE`,
            weight_interpretation: `comfy`,
            positive: form.positive,
            negative: form.negative,
        })

        const sampler = graph.UltimateSDUpscaleNoUpscale({
            mode_type: `Linear`,
            force_uniform_tiles: `enable`,
            seam_fix_mode: `None`,

            seed: form.seed,
            steps: form.steps,
            denoise: form.denoise,

            tile_width: 512,
            tile_height: 768,

            cfg: form.config,
            sampler_name: form.lcm ? 'lcm' : `dpmpp_3m_sde_gpu`,
            scheduler: form.lcm ? 'normal' : `karras`,

            model: loader,
            vae: loader.outputs.VAE,
            positive: loader.outputs.CONDITIONING$6, //graph.CLIPTextEncode({ text: form.positive, clip: loader }),
            negative: loader.outputs.CONDITIONING$7, //graph.CLIPTextEncode({ text: form.positive, clip: loader }),

            upscaled_image: startImage,
        })

        const finalImage = sampler.outputs.IMAGE

        return { image: finalImage }
    },
})

export const samplingOperations = {
    sampler,
    ultimateUpscale,
}
