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
import { OptimizerComponent, OptimizerComponentViewState } from './src/optimizer'
import { GlobalFunctionToDefineAnApp, WidgetDict } from 'src/cards/Card'
import { number } from 'zod'

const formOptimize = <TOpts, TResult extends Widget, TResultNonOpt extends Widget>(
    form: FormBuilder,
    formCreate: (opts: TOpts) => TResult,
    formCreateNonOptional: (opts: TOpts) => TResultNonOpt,
    opts: TOpts,
    options?: { isOptional: boolean; includeMinMax?: boolean },
) => {
    return (options?.isOptional ? form.groupOpt : form.group)({
        items: () => ({
            _value: formCreate(opts),
            _optimize: form.groupOpt({
                layout: `V`,
                items: () => ({
                    ...(!options?.includeMinMax
                        ? {}
                        : {
                              min: formCreateNonOptional(opts),
                              max: formCreateNonOptional(opts),
                              distribution: form.selectOne({ choices: [{ id: `normal` }, { id: `linear` }] }),
                          }),
                    count: form.int({ label: `Iterations`, default: 5, min: 1, max: 100 }),
                    run: form.inlineRun({ text: `Run`, className: `self-end` }),
                    clear: form.inlineRun({ text: `Clear`, kind: `warning` }),
                    results: form.markdown({
                        label: ``,
                        markdown: () => ``,
                        customComponent: OptimizerComponent,
                    }),
                }),
            }),
        }),
    })
}

let appOptimized: GlobalFunctionToDefineAnApp = ({ ui, run }) => {
    return app({
        ui: !ui
            ? undefined
            : (form) => {
                  const formBuilderCustom = {
                      ...form,
                      int: (opts: Widget_int_opts) =>
                          formOptimize(form, form.int, form.int, opts, { isOptional: false, includeMinMax: true }),
                      intOpt: (opts: Widget_intOpt_opts) =>
                          formOptimize(form, form.intOpt, form.int, opts, { isOptional: true, includeMinMax: true }),
                      float: (opts: Widget_float_opts) =>
                          formOptimize(form, form.float, form.float, opts, { isOptional: false, includeMinMax: true }),
                      floatOpt: (opts: Widget_floatOpt_opts) =>
                          formOptimize(form, form.floatOpt, form.float, opts, { isOptional: true, includeMinMax: true }),
                  }

                  return ui(formBuilderCustom as unknown as FormBuilder)
              },
        run: async (runtime, formResultsRaw) => {
            const formSerial = runtime.formSerial

            const optimizationState = {
                count: 1,
            }
            const optimizedValues = [] as {
                varPath: string[]
            }[]

            const injectOptimizedValue = (vRaw: unknown, varPath: string[]): typeof vRaw => {
                if (!vRaw || typeof vRaw !== `object`) {
                    return vRaw
                }

                if (Array.isArray(vRaw)) {
                    return vRaw.map((x, i) => injectOptimizedValue(x, [...varPath, `${i}`]))
                }

                const v = vRaw as Record<string, unknown>

                if (!(`_optimize` in v)) {
                    return Object.fromEntries(Object.entries(v).map(([k, v2]) => [k, injectOptimizedValue(v2, [...varPath, k])]))
                }

                optimizedValues.push({ varPath })

                let value = v._value as unknown

                if (!v._optimize) {
                    return value as typeof v
                }

                // TODO: simulated annealing?

                // Random value on normal curve
                const optimize = v._optimize as {
                    min?: number
                    max?: number
                    distribution?: `normal` | `linear`
                    count?: number
                    run?: boolean
                }
                const { min, max, distribution, count, run: runButton } = optimize

                if (runButton && count && count > optimizationState.count) {
                    optimizationState.count = count
                }

                const generateNormalLikeRandomValue = (): number => {
                    // Box-Muller transform, out of bounds rejected
                    while (true) {
                        const z1 = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random())
                        const normalValue = 0.5 * z1 + 0.5
                        if (normalValue >= 0 && normalValue <= 1) {
                            return normalValue
                        }
                    }
                }

                if (typeof min === `number` && typeof max === `number`) {
                    value = min + (max - min) * (distribution === `linear` ? 1 : generateNormalLikeRandomValue())

                    if (Number.isInteger(v._value) && Number.isInteger(min) && Number.isInteger(max)) {
                        value = Math.round(value as number)
                    }
                }

                console.log(`appOptimized: random normal value`, {
                    min,
                    max,
                    value,
                    v,
                    vRaw: JSON.parse(JSON.stringify(vRaw)),
                    // formResultsRaw: JSON.parse(JSON.stringify(formResultsRaw)),
                    // formResults: JSON.parse(JSON.stringify(formResults)),
                    // formSerial: JSON.parse(JSON.stringify(formSerial)),
                })

                return value as typeof v
            }

            let formResults = injectOptimizedValue(formResultsRaw, [])

            console.log(`appOptimized injected optimized values`, {
                formResultsRaw: JSON.parse(JSON.stringify(formResultsRaw)),
                formResults: JSON.parse(JSON.stringify(formResults)),
                formSerial: JSON.parse(JSON.stringify(formSerial)),
            })

            const navigateToOptimizationVar = (varPath: string[]) => {
                let raw = formResultsRaw
                let res = formResults as typeof formResultsRaw
                let ser = formSerial

                for (const p of varPath) {
                    raw = raw?.[p] as typeof raw
                    res = res?.[p] as typeof res
                    ser = ser?.[p] as typeof ser
                    if (`values_` in ser) {
                        ser = ser[`values_`] as typeof ser
                    }
                    if (`items_` in ser) {
                        ser = ser[`items_`] as typeof ser
                    }
                    if (`elements_` in ser) {
                        ser = ser[`elements_`] as typeof ser
                    }
                }

                const rawTyped = raw as {
                    _value: unknown
                    _optimize:
                        | undefined
                        | {
                              preview: boolean
                              results: unknown
                              clear: boolean
                          }
                }

                const serTyped = ser as {
                    _optimize: {
                        values_: {
                            results: {
                                componentValue: OptimizerComponentViewState
                            }
                        }
                    }
                }

                return {
                    formResultRawValue: rawTyped,
                    formResultValue: res,
                    formSerialValue: serTyped,
                    formSerialOptimizeValue: serTyped._optimize.values_,
                }
            }

            // handle clear
            for (const o of optimizedValues) {
                const { formResultRawValue, formSerialOptimizeValue } = navigateToOptimizationVar(o.varPath)
                if (formResultRawValue._optimize?.clear) {
                    formSerialOptimizeValue.results.componentValue.images = []
                    formSerialOptimizeValue.results.componentValue = { ...formSerialOptimizeValue.results.componentValue }
                    return
                }
            }

            for (let i = 0; i < optimizationState.count; i++) {
                console.log(`appOptimized running ${i}`, {
                    optimizedValues,
                })

                if (i > 0) {
                    formResults = injectOptimizedValue(formResultsRaw, [])
                }

                await run(runtime, formResults as unknown as typeof formResultsRaw)

                // const generatedOutputIds = [runtime.step.lastOutput].map((x) => x?.id ?? ``).filter((x) => x)
                const generatedOutputIds = runtime.step.generatedImages.map((x) => x?.id ?? ``).filter((x) => x)

                console.log(`appOptimized ran`, {
                    optimizedValues,
                    generatedOutputIds,
                    generatedImages: runtime.step.generatedImages,
                })

                optimizedValues.forEach((x) => {
                    const { formResultValue, formSerialOptimizeValue } = navigateToOptimizationVar(x.varPath)

                    const usedValue = formResultValue as unknown

                    const compValue = formSerialOptimizeValue.results.componentValue ?? {}
                    compValue.images = [
                        ...(compValue.images ?? []),
                        ...generatedOutputIds
                            .filter((x) => !compValue.images?.some((y) => y.imageId === x))
                            .map((x) => ({
                                value: usedValue,
                                imageId: x,
                            })),
                    ]
                    formSerialOptimizeValue.results.componentValue = { ...compValue }

                    // const v = ser.values_ as ;
                    console.log(`optimizedValues forEach`, {
                        usedValue,
                        formResultValue,
                        formSerialOptimizeValue,
                        x,
                        formResults,
                        formSerial: JSON.parse(JSON.stringify(formSerial)),
                    })
                })
            }
        },
    })
}

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
