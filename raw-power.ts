import {
    FormBuilder,
    Widget,
    Widget_floatOpt_opts,
    Widget_float_opts,
    Widget_group,
    Widget_group_output,
    Widget_group_serial,
    Widget_inlineRun,
    Widget_int,
    Widget_intOpt_opts,
    Widget_int_opts,
    Widget_list_output,
    Widget_markdown,
} from 'src'
import { ComfyWorkflowBuilder } from 'src/back/NodeBuilder'
import { StopError, operation_mask } from './src/_maskPrefabs'
import { TestComponentWrapper } from './src/test'
import { OptimizerComponent, OptimizerComponentViewState, appOptimized } from './src/optimizer'
import { GlobalFunctionToDefineAnApp, WidgetDict } from 'src/cards/Card'

let renderCount = 0
appOptimized({
    ui: (form) => ({
        workingDirectory: form.str({}),

        startImage: form.image({}),
        _1: form.markdown({
            markdown: () => `# Prepare Image ${renderCount++} ${new Date()}`,
            customComponent: TestComponentWrapper,
        }),

        // crop1:
        cropMaskOperations: operation_mask.ui(form),
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
        startStepFromEnd: form.intOpt({ default: 0, min: 0, max: 100 }),
        endStepFromEnd: form.intOpt({ default: 0, min: 0, max: 100 }),
        config: form.float({ default: 1.5 }),
        add_noise: form.bool({ default: true }),

        render: form.inlineRun({}),
        // test: form.image({
        //     default: `cushy`,
        //     // defaultCushy:{ }
        // }),

        //     }),
        // }),

        // testTimeline: form.timeline({
        //     width: 100,
        //     height: 100,
        //     element: () => ({
        //         item: form.str({ default: `ball` }),
        //     }),
        // }),
        // testRegional: form.regional({
        //     width: 100,
        //     height: 100,
        //     element: () => ({
        //         item: form.str({ default: `ball` }),
        //     }),
        // }),
    }),
    run: async (flow, form) => {
        // flow.formSerial._1.componentValue=
        // flow.AUTO

        // const getOptimizeredValue = async (
        //     formResult: Widget_group_output<{
        //         readonly value: Widget_int
        //         readonly preview: Widget_inlineRun
        //         readonly results: Widget_markdown
        //     }>,
        //     formSerial: Widget_group_serial<{
        //         readonly value: Widget_int
        //         readonly preview: Widget_inlineRun
        //         readonly results: Widget_markdown
        //     }>,
        // ) => {
        //     const id = formSerial.id

        //     // populate results
        //     // const componentValue: OptimizerComponentViewState = {
        //     //     images: flow.generatedImages.map((x) => ({
        //     //         inputValue: 0
        //     //         path: x.filename,
        //     //     })),
        //     // }
        //     // formSerial.values_.results.componentValue = componentValue
        //     // get optimal value

        //     return formResult.value
        // }

        // const addOptimizerResult = (
        //     image: { path: string },
        //     value: number,
        //     formSerial: Widget_group_serial<{
        //         readonly value: Widget_int
        //         readonly preview: Widget_inlineRun
        //         readonly results: Widget_markdown
        //     }>,
        // ) => {
        //     const componentValue: OptimizerComponentViewState = formSerial.values_.results.componentValue ?? {
        //         images: [],
        //     }

        //     componentValue.images?.push({
        //         path: image.path,
        //         value,
        //     })

        //     formSerial.values_.results.componentValue = { ...componentValue }
        // }

        try {
            setTimeout(() => {
                // flow.st.currentDraft.gui.value?.state
                flow.formSerial._1.componentValue = { items: [`cool`, `its`, `working`] }
            }, 1000)

            flow.print(`${JSON.stringify(form)}`)

            // flow.output_File({});

            // flow.output_HTML({
            //     title: `preview2`,
            //     htmlContent: testHtmlContent,
            // })

            // Build a ComfyUI graph
            const graph = flow.nodes
            const state = { flow, graph, scopeStack: [{}] }

            // load, crop, and resize image
            const startImage = await flow.loadImageAnswer(form.startImage)

            const cropMask = await operation_mask.run(state, startImage, undefined, form.cropMaskOperations)

            const { size: sizeInput } = form
            const size = typeof sizeInput === `number` ? sizeInput : Number(sizeInput.id)
            const { cropped_image } = !cropMask
                ? { cropped_image: startImage }
                : graph.RL$_Crop$_Resize({ image: startImage, mask: cropMask, max_side_length: size }).outputs

            // TODO: move replaceMask before crop so it is built on original pixels
            const replaceMask = await operation_mask.run(state, cropped_image, undefined, form.replaceMaskOperations)

            const loraStack = graph.LoRA_Stacker({
                input_mode: `simple`,
                lora_count: 1,
                lora_name_1: `lcm-lora-sdxl.safetensors`,
            } as LoRA_Stacker_input)

            const loader = graph.Efficient_Loader({
                ckpt_name: `protovisionXLHighFidelity3D_beta0520Bakedvae.safetensors`,
                lora_stack: flow.AUTO(),
                // defaults
                lora_name: `None`,
                token_normalization: `none`,
                vae_name: `Baked VAE`,
                weight_interpretation: `comfy`,
                positive: form.positive,
                negative: ``,
            })

            const startLatent = (() => {
                const startLatent0 = graph.VAEEncode({ pixels: cropped_image, vae: loader })
                if (!replaceMask) {
                    return startLatent0
                }
                const startLatent1 = graph.SetLatentNoiseMask({ samples: startLatent0, mask: replaceMask })
                return startLatent1
            })()

            const seed = flow.randomSeed()
            const sampler = graph.KSampler_Adv$5_$1Efficient$2({
                add_noise: form.add_noise ? `enable` : `disable`,
                return_with_leftover_noise: `disable`,
                vae_decode: `true`,
                preview_method: `auto`,
                noise_seed: seed,
                steps: form.steps,
                start_at_step: !form.startStepFromEnd ? 0 : form.steps - form.startStepFromEnd,
                end_at_step: form.steps - (form.endStepFromEnd ?? 0),

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
