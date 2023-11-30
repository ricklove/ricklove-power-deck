import { FormBuilder } from 'src';

const createMaskForm = (form: FormBuilder, optional = false) => {
    return (optional ? form.groupOpt : form.group)({
        layout: 'V',
        items: () => ({
            prompt: form.str({ default: `ball` }),
            unmask: form.bool({ default: false }),
            threshold: form.float({ default: 0.4, min: 0, max: 1, step: 0.01 }),
            dilation: form.int({ default: 4, min: 0 }),
            blur: form.float({ default: 1, min: 0 }),
            dilationAfter: form.int({ default: 6, min: 0 }),
            preview: form.bool({}),
        }),
    });
};

app({
    ui: (form) => ({
        workingDirectory: form.str({}),
        startImage: form.image({}),
        _1: form.markdown({ markdown: `# Prepare Image` }),
        cropPrompt: form.str({ default: `person` }),
        previewCrop: form.bool({}),
        // mask: createMaskForm(form),
        // mask1: createMaskForm(form),
        // mask2: createMaskForm(form),
        // mask3: createMaskForm(form),
        masks: form.list({
            element: () => createMaskForm(form),
        }),
        previewMasks: form.bool({}),

        _2: form.markdown({ markdown: `# Modify Image` }),
        // g: form.groupOpt({
        //     items: () => ({
        positive: form.str({}),
        //     }),
        // }),
    }),
    run: async (flow, form) => {
        flow.print(`${JSON.stringify(form)}`);

        // Build a ComfyUI graph
        const graph = flow.nodes;

        // load, crop, and resize image
        const startImage = await flow.loadImageAnswer(form.startImage);
        const cropMask = graph.CLIPSeg({ image: startImage, text: form.cropPrompt });
        const { cropped_image } = graph.RL$_Crop$_Resize({ image: startImage, mask: cropMask }).outputs;

        if (form.previewCrop) {
            graph.PreviewImage({ images: cropMask.outputs.Heatmap$_Mask });
            graph.PreviewImage({ images: cropped_image });
            await flow.PROMPT();
            return;
        }

        // runtime.print(`masks ${JSON.stringify(form.masks)}`);
        const combineMasks = (a: _MASK, b: _MASK, operation: `union` | `intersection` | `aNotB`) => {
            if (operation === `aNotB`) {
                b = graph.InvertMask({ mask: b });
            }

            return graph.ImageToMask$_AS({
                image: graph.Combine_Masks({
                    image1: graph.MaskToImage({ mask: a }),
                    image2: graph.MaskToImage({ mask: b }),
                    op: operation === `union` ? `union (max)` : `intersection (min)`,
                    clamp_result: `yes`,
                    round_result: `no`,
                }).outputs.IMAGE,
            });
        };

        let mask = undefined as undefined | _MASK;
        let unmask = undefined as undefined | _MASK;
        for (const x of form.masks) {
            if (!x) {
                return;
            }

            const maskRaw = graph.CLIPSeg({
                image: cropped_image,
                text: x.prompt,
                threshold: x.threshold,
                dilation_factor: x.dilation,
                blur: x.blur,
            });

            const maskDilated = graph.Mask_Dilate_Region({ masks: maskRaw, iterations: x.dilationAfter });
            if (!x.unmask) {
                mask = !mask ? maskDilated : combineMasks(mask, maskDilated, `union`);
            } else {
                unmask = !unmask ? maskDilated : combineMasks(unmask, maskDilated, `union`);
            }

            if (x.preview) {
                const maskAsImage = graph.MaskToImage({ mask: maskDilated });
                const maskPreview = graph.ImageBlend({
                    image1: maskAsImage,
                    image2: cropped_image,
                    blend_mode: `normal`,
                    blend_factor: 0.5,
                });
                graph.PreviewImage({ images: maskRaw.outputs.Heatmap$_Mask });
                graph.PreviewImage({ images: maskPreview });
                await flow.PROMPT();
                return;
            }
        }

        mask = !mask || !unmask ? mask : combineMasks(mask, unmask, `aNotB`);
        if (form.previewMasks) {
            if (!mask) {
                flow.print(`No Mask Defined`);
                return;
            }
            const maskAsImage = graph.MaskToImage({ mask });
            const maskPreview = graph.ImageBlend({
                image1: maskAsImage,
                image2: cropped_image,
                blend_mode: `normal`,
                blend_factor: 0.5,
            });
            graph.PreviewImage({ images: maskPreview });
            await flow.PROMPT();
            return;
        }

        const loraStack = graph.LoRA_Stacker({
            input_mode: `simple`,
            lora_count: 1,
            lora_name_1: `lcm-lora-sdxl.safetensors`,
        } as LoRA_Stacker_input);

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
        });

        const startLatent = (() => {
            const startLatent0 = graph.VAEEncode({ pixels: cropped_image, vae: loader });
            if (!mask) {
                return startLatent0;
            }
            const startLatent1 = graph.SetLatentNoiseMask({ samples: startLatent0, mask });
            return startLatent1;
        })();

        const seed = flow.randomSeed();
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
            start_at_step: 7,

            model: loader,
            positive: loader.outputs.CONDITIONING$6, //graph.CLIPTextEncode({ text: form.positive, clip: loader }),
            negative: loader.outputs.CONDITIONING$7, //graph.CLIPTextEncode({ text: form.positive, clip: loader }),
            // negative: graph.CLIPTextEncode({ text: '', clip: loader }),
            // latent_image: graph.EmptyLatentImage({ width: 512, height: 512, batch_size: 1 }),
            latent_image: startLatent,
        });

        graph.SaveImage({
            images: graph.VAEDecode({ samples: sampler, vae: loader }),
            filename_prefix: 'ComfyUI',
        });

        // Run the graph you built
        const result = await flow.PROMPT();

        // Disable some nodes
        const iDisableStart = flow.workflow.nodes.indexOf(cropMask) + 1;
        flow.workflow.nodes.slice(iDisableStart).forEach((x) => x.disable());

        // Build new graph with part of old graph
        graph.PreviewImage({ images: cropMask.outputs.Heatmap$_Mask });

        // Run new graph
        await flow.PROMPT();

        // result.delete();
        // result.

        // Undisable all nodes so they can be rendered in the graph view
        // flow.workflow.nodes.forEach((x) => (x.disabled = false));
    },
});

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
