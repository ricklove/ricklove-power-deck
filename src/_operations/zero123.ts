import { createFrameOperation } from './_frame'
import { videoOperations } from './video'

const zero123 = createFrameOperation({
    ui: (form) => ({
        orbit: form.orbit({}),
        seed: form.seed({}),
        steps: form.int({ default: 20 }),
        freeU: form.boolean({ default: false }),
        sampler: form.enum.Enum_KSampler_sampler_name({
            default: `euler`,
        }),
        scheduler: form.enum.Enum_KSampler_scheduler({
            default: `sgm_uniform`,
        }),
        depthImageVariable: form.stringOpt({ default: `zoe` }),
        width: form.int({ default: 256 }),
        height: form.int({ default: 256 }),
        segmentCount: form.int({ default: 1 }),
        batchSizeForPyramidReduce: form.int({ default: 1 }),
    }),
    run: (state, form, frame) => {
        const { runtime, graph } = state
        const { image, frameIdProvider } = frame
        const ckpt = graph.ImageOnlyCheckpointLoader({ ckpt_name: 'stable_zero123.ckpt' })

        const sz123 = graph.StableZero123$_Conditioning({
            width: form.width,
            height: form.height,
            batch_size: form.batchSizeForPyramidReduce,
            elevation: form.orbit.elevation,
            azimuth: form.orbit.azimuth,

            clip_vision: ckpt.outputs.CLIP_VISION,
            init_image: image,
            vae: ckpt,
        })

        frameIdProvider.subscribe((_) => {
            const iFrame = frameIdProvider.get().currentFrameIdIndex
            const segmentCount = form.segmentCount
            const iSegment = (1 + (iFrame % segmentCount)) / segmentCount
            sz123.inputs.elevation = form.orbit.elevation * iSegment
            sz123.inputs.azimuth = form.orbit.azimuth * iSegment
            runtime.output_text({
                title: `zero123`,
                message: `${iSegment}: (${sz123.inputs.azimuth},${sz123.inputs.elevation})`,
            })
        })

        //                 graph.LoraLoader({
        //     clip: ckpt.outputs.CLIP_VISION,
        //     lora_name:`lcm-lora-sd.safetensors`,
        // })

        // graph.ControlNetLoader({
        //     control_net_name:`controlnet-zp11-depth-v1`
        // })

        let latent = graph.KSampler({
            seed: form.seed,
            steps: form.steps,
            cfg: 4,
            sampler_name: form.sampler,
            scheduler: form.scheduler,
            denoise: 1,
            model: form.freeU
                ? graph.FreeU({ model: ckpt.outputs.MODEL, b1: 1.2, b2: 1.2, s1: 1.1, s2: 0.2 }).outputs.MODEL
                : ckpt,
            positive: sz123.outputs.positive,
            negative: sz123.outputs.negative,
            latent_image: sz123,
        })

        let batchImages = graph.VAEDecode({ samples: latent, vae: ckpt }).outputs.IMAGE

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

export const zeroOperations = {
    zero123,
}
