import type { FormBuilder } from 'src/controls/FormBuilder'
export const ui_vaeName = (form: FormBuilder) =>
    form.enumOpt.Enum_VAELoader_vae_name({
        label: 'VAE',
    })

export const ui_modelName = (form: FormBuilder) =>
    form.enum.Enum_CheckpointLoaderSimple_ckpt_name({
        label: 'Checkpoint',
    })
