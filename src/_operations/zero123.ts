import { createFrameOperation, createFrameOperationsGroupList } from './_frame'

const zero123 = createFrameOperation({
    ui: (form) => ({
        angle: form.float({ default: 0, min: -180, max: 180 }),
        elevation: form.float({ default: 0, min: -90, max: 90 }),
        seed: form.seed({}),
        steps: form.int({ default: 20 }),
        sampler: form.enum({
            enumName: `Enum_KSampler_sampler_name`,
            default: `euler`,
        }),
        scheduler: form.enum({
            enumName: `Enum_KSampler_scheduler`,
            default: `sgm_uniform`,
        }),
    }),
    run: ({ runtime, graph }, form, { image }) => {
        const ckpt = graph.ImageOnlyCheckpointLoader({ ckpt_name: 'stable_zero123.ckpt' })
        const sz123 = graph.StableZero123$_Conditioning({
            width: 256,
            height: 256,
            batch_size: 1,
            elevation: form.elevation,
            azimuth: form.angle,
            clip_vision: ckpt.outputs.CLIP_VISION,
            init_image: image,
            vae: ckpt,
        })

        let latent = graph.KSampler({
            seed: form.seed,
            steps: form.steps,
            cfg: 4,
            sampler_name: form.sampler,
            scheduler: form.scheduler,
            denoise: 1,
            model: ckpt,
            positive: sz123.outputs.positive,
            negative: sz123.outputs.negative,
            latent_image: sz123,
        })

        let resultImage = graph.VAEDecode({ samples: latent, vae: ckpt }).outputs.IMAGE

        return { image: resultImage }
    },
})

export const zeroOperations = {
    zero123,
}
export const zeroOperationsList = createFrameOperationsGroupList(zeroOperations)
