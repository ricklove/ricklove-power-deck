import { PreviewStopError, loadFromScope } from '../_appState'
import { createImageOperation } from './_frame'
import { storageOperations } from './storage'
import { videoOperations } from './video'

const defaultLoraNames = Object.fromEntries([...new Array(100)].map((_, i) => [`lora_name_${i}`, `None`])) as unknown as Record<
    `lora_name_${
        //
        `0` | `1` | `2` | `3` | `4` | `5` | `6` | `7` | `8` | `9`
    }${
        //
        `` | `0` | `1` | `2` | `3` | `4` | `5` | `6` | `7` | `8` | `9`
    }`,
    `None`
>

const sampler = createImageOperation({
    ui: (form) => ({
        useImpaintingEncode: form.bool({ default: false }),
        previewLatent: form.inlineRun({}),
        add_noise: form.bool({ default: true }),

        controlNet: form.list({
            element: () =>
                form.group({
                    items: () => ({
                        enabled: form.bool({ default: true }),
                        controlNet: form.enum.Enum_ControlNetLoader_control_net_name({
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

        loras: form.list({
            element: () =>
                form.group({
                    items: () => ({
                        enabled: form.bool({ default: true }),
                        lora: form.enum.Enum_LoRA_Stacker_lora_name_1({
                            default: 'add-detail-xl.safetensors',
                        }),
                        clipStrength: form.float({ default: 1, min: 0, max: 1, step: 0.01 }),
                        modelStrength: form.float({ default: 1, min: 0, max: 1, step: 0.01 }),
                    }),
                }),
        }),

        positive: form.string({
            textarea: true,
        }),
        negative: form.string({
            textarea: true,
        }),

        seed: form.seed({}),

        steps: form.int({ default: 11, min: 0, max: 100 }),
        startStep: form.intOpt({ default: 1, min: 0, max: 100 }),
        startStepFromEnd: form.intOpt({ default: 1, min: 0, max: 100 }),
        stepsToIterate: form.intOpt({ default: 2, min: 0, max: 100 }),
        endStep: form.intOpt({ default: 1000, min: 0, max: 100 }),
        endStepFromEnd: form.intOpt({ default: 0, min: 0, max: 100 }),

        checkpoint: form.enum.Enum_CheckpointLoaderSimple_ckpt_name({
            default: 'nightvisionXLPhotorealisticPortrait_release0770Bakedvae.safetensors',
        }),
        sampler: form.enum.Enum_KSampler_sampler_name({
            default: `dpmpp_3m_sde_gpu`,
        }),
        scheduler: form.enum.Enum_KSampler_scheduler({
            default: `karras`,
        }),
        // sdxl: form.bool({ default: true }),
        // lcm: form.bool({ default: true }),
        // lcmTurbo: form.bool({ default: true }),
        // freeU: form.bool({ default: true }),
        config: form.float({ default: 1.5 }),
        batchSizeForPyramidReduce: form.int({ default: 1, min: 1, max: 16 }),
        script: form.string({
            textarea: true,
            placeHolder: `
            1+3/12 (start at 1 for 3 steps at total steps 12)
            1+3/12@0.5 (start at 1 for 3 steps at total steps 12 at config 0.5)
            config=1.5 (set config to 1.5 for next step)
            *3(multiply latents)
            merge(merge latents)
            init=0.5(merge with original latent at blend strength)
            controlnet[0]@0.5 (set controlnet strength to 0.5)
            `,
        }),
    }),
    run: (state, form, frame) => {
        const { runtime, graph } = state
        const { image, mask } = frame
        const startImage = image
        const replaceMask = mask

        let controlNetStack = undefined as undefined | _CONTROL_NET_STACK
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

        const allLoras: {
            lora: Enum_LoRA_Stacker_lora_name_1
            clipStrength: number
            modelStrength: number
        }[] = [
            ...(form.lcmTurbo && form.sdxl
                ? [
                      {
                          lora: `LCMTurboMix_Euler_A_fix.safetensors`,
                          clipStrength: 1,
                          modelStrength: 1,
                      } as const,
                  ]
                : form.lcm
                ? [
                      {
                          lora: !form.sdxl ? `lcm-lora-sd.safetensors` : `lcm-lora-sdxl.safetensors`,
                          clipStrength: 1,
                          modelStrength: 1,
                      } as const,
                  ]
                : []),
            ...(form.loras.filter((x) => x.enabled) ?? []),
        ]

        const loraEntries = allLoras.map((x, i) => ({
            [`lora_name_${i + 1}`]: x.lora,
            [`clip_str_${i + 1}`]: x.clipStrength,
            [`model_str_${i + 1}`]: x.modelStrength,
        }))

        const loraStack = loraEntries.length
            ? graph.LoRA_Stacker({
                  input_mode: `advanced`,
                  lora_count: loraEntries.length,
                  ...defaultLoraNames,
                  ...Object.fromEntries(loraEntries.flatMap((x) => Object.entries(x))),
              }).outputs.LORA_STACK
            : undefined

        // for(const lora of form.loras){
        //     loraStack = graph.LoRA_Stacker({
        //         lora
        //     }).outputs.LORA_STACK
        // }

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
        let latentCount = 1
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
            latentCount = form.batchSizeForPyramidReduce
        }

        const parseScript = (script: string) => {
            if (!script.trim()) {
                return [{ index: 0 }]
            }

            const lines = script
                .split(`\n`)
                .map((x) => x.trim())
                .filter((x) => x && !x.startsWith(`//`))
            const commands = [] as {
                index: number
                startStep?: number
                stepsToIterate?: number
                steps?: number
                // controlNetStrength?: number
                config?: number
                mergeLatents?: boolean
                multiplyLatents?: number
                blendInitialLatent?: number
            }[]

            let command = { index: 0 } as (typeof commands)[0]
            for (const l of lines) {
                let m = l.match(/^([\d]+)\s*\+\s*(\d+)\s*\/\s*(\d+)(?:\s*@\s*([\d\.]+))$/)
                if (m) {
                    command.startStep = parseInt(m[1])
                    command.stepsToIterate = parseInt(m[2])
                    command.steps = parseInt(m[3])
                    if (m[4]) {
                        command.config = parseFloat(m[4])
                    }

                    commands.push(command)
                    command = { index: commands.length }
                    continue
                }

                m = l.match(/^config\s*\=\s*([\d\.]+)$/i)
                if (m) {
                    command.config = parseFloat(m[1])
                    continue
                }

                m = l.match(/^init\s*\=\s*([\d\.]+)$/i)
                if (m) {
                    command.blendInitialLatent = parseFloat(m[1])
                    commands.push(command)
                    command = { index: commands.length }
                    continue
                }

                m = l.match(/^\*(\d+)$/i)
                if (m) {
                    command.multiplyLatents = parseInt(m[1])
                    commands.push(command)
                    command = { index: commands.length }
                    continue
                }

                m = l.match(/^merge$/i)
                if (m) {
                    command.mergeLatents = true
                    commands.push(command)
                    command = { index: commands.length }
                    continue
                }
            }

            if (!commands.length) {
                commands.push({ index: 0 })
            }

            runtime.output_text({
                title: `sampler script`,
                message: JSON.stringify(commands, null, 2),
            })

            return commands
        }

        const scriptCommands = parseScript(form.script)
        for (const command of scriptCommands ?? [{}]) {
            if (scriptCommands.length > 1 && command.index === 0) {
                graph.PreviewImage({ images: graph.VAEDecode({ samples: latent, vae: loader }).outputs.IMAGE })
            }

            if (command.multiplyLatents) {
                latent = graph.RepeatLatentBatch({
                    samples: latent,
                    amount: command.multiplyLatents,
                }).outputs.LATENT
                latentCount *= command.multiplyLatents
                continue
            }
            if (command.mergeLatents) {
                const allLatents = latent
                latent = graph.selectLatentFromBatch_$_O({ samples: allLatents, index: 0 }).outputs.LATENT

                for (let i = 1; i < latentCount; i++) {
                    latent = graph.LatentBlend({
                        samples1: graph.selectLatentFromBatch_$_O({ samples: allLatents, index: i }).outputs.LATENT,
                        samples2: latent,
                        blend_factor: 1 / (i + 1),
                    }).outputs.LATENT
                }

                latent = graph.SetLatentNoiseMask({ samples: latent, mask: replaceMask }).outputs.LATENT
                graph.PreviewImage({ images: graph.VAEDecode({ samples: latent, vae: loader }).outputs.IMAGE })
                continue
            }
            if (command.blendInitialLatent !== undefined) {
                latent = graph.LatentBlend({
                    samples1: startLatent._LATENT,
                    samples2: latent,

                    // samples1: graph.selectLatentFromBatch_$_O({ samples: latent, index: 0 }).outputs.LATENT,
                    // samples2: graph.VAEEncode({ pixels: startImage, vae: loader }),
                    blend_factor: command.blendInitialLatent,
                }).outputs.LATENT

                latent = graph.SetLatentNoiseMask({ samples: latent, mask: replaceMask }).outputs.LATENT
                graph.PreviewImage({ images: graph.VAEDecode({ samples: latent, vae: loader }).outputs.IMAGE })
                continue
            }

            const _form = {
                steps: form.steps,
                startStep: form.startStep,
                startStepFromEnd: form.startStepFromEnd,
                endStep: form.endStep,
                endStepFromEnd: form.endStepFromEnd,
                stepsToIterate: form.stepsToIterate,

                seed: form.seed,
                add_noise: form.add_noise,
                config: form.config,
            }

            if (command.steps) {
                _form.steps = command.steps
                _form.startStep = command.startStep
                _form.startStepFromEnd = undefined
                _form.endStep = undefined
                _form.endStepFromEnd = undefined
                _form.stepsToIterate = command.stepsToIterate
            }

            _form.seed = form.seed + command.index * 1037
            _form.add_noise = command.index === 0 ? form.add_noise : false
            _form.config = command.config ?? form.config

            const startStep = Math.max(
                0,
                Math.min(
                    _form.steps - 1,
                    _form.startStep ? _form.startStep : _form.startStepFromEnd ? _form.steps - _form.startStepFromEnd : 0,
                ),
            )
            const endStep = Math.max(
                1,
                Math.min(
                    _form.steps,
                    _form.endStep
                        ? _form.endStep
                        : _form.endStepFromEnd
                        ? _form.steps - _form.endStepFromEnd
                        : _form.stepsToIterate
                        ? startStep + _form.stepsToIterate
                        : _form.steps,
                ),
            )
            const seed = _form.seed
            const sampler = graph.KSampler_Adv$5_$1Efficient$2({
                add_noise: _form.add_noise ? `enable` : `disable`,
                return_with_leftover_noise: `disable`,
                vae_decode: `false`,
                preview_method: `none`,
                noise_seed: seed,
                steps: _form.steps,
                start_at_step: startStep,
                end_at_step: endStep,

                cfg: _form.config,
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

            latent = sampler.outputs.LATENT

            if (scriptCommands.length > 1) {
                graph.PreviewImage({ images: graph.VAEDecode({ samples: latent, vae: loader }).outputs.IMAGE })
            }
        }

        // const finalImage = graph.VAEDecode({ samples: sampler, vae: loader }).outputs.IMAGE

        // return { image: finalImage }

        let batchImages = graph.VAEDecode({ samples: latent, vae: loader }).outputs.IMAGE

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

const ultimateUpscale = createImageOperation({
    ui: (form) => ({
        controlNet: form.list({
            element: () =>
                form.group({
                    items: () => ({
                        enabled: form.bool({ default: true }),
                        controlNet: form.enum.Enum_ControlNetLoader_control_net_name({
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

        positive: form.string({}),
        negative: form.string({}),

        seed: form.seed({}),
        steps: form.int({ default: 20 }),
        denoise: form.float({ default: 0.4, min: 0, max: 1, step: 0.01 }),

        // steps: form.int({ default: 11, min: 0, max: 100 }),
        // startStep: form.intOpt({ default: 1, min: 0, max: 100 }),
        // startStepFromEnd: form.intOpt({ default: 1, min: 0, max: 100 }),
        // stepsToIterate: form.intOpt({ default: 2, min: 0, max: 100 }),
        // endStep: form.intOpt({ default: 1000, min: 0, max: 100 }),
        // endStepFromEnd: form.intOpt({ default: 0, min: 0, max: 100 }),

        checkpoint: form.enum.Enum_CheckpointLoaderSimple_ckpt_name({
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

        let controlNetStack = undefined as undefined | _CONTROL_NET_STACK
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
                  ...defaultLoraNames,
                  lora_name_1: `lcm-lora-sd.safetensors`,
              }).outputs.LORA_STACK

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
            force_uniform_tiles: true,
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
