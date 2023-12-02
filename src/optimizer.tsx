import React, { useState } from 'react'
import { renderToString } from 'react-dom/server'
import { Widget_CustomComponentProps } from 'src'
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
import { GlobalFunctionToDefineAnApp, WidgetDict } from 'src/cards/Card'

export type OptimizerComponentViewState = InteractiveViewState & {
    images?: { imageId: string; value: unknown }[]
}
export const OptimizerComponent = (props: Widget_CustomComponentProps) => {
    return <OptimizerComponentInner {...(props as Widget_CustomComponentProps<OptimizerComponentViewState>)} />
}

const OptimizerComponentInner = (props: Widget_CustomComponentProps<OptimizerComponentViewState>) => {
    const { value = {} } = props
    const change = (v: Partial<OptimizerComponentViewState>) => {
        props.onChange({ ...props.value, ...v })
    }

    const imagesSorted = (value.images ?? [])?.sort((a, b) => {
        if (typeof a.value === `number` && typeof b.value === `number`) {
            return a.value - b.value
        }

        return `${a.value}`.localeCompare(`${b.value}`)
    })

    return (
        <div>
            <div className='flex flex-row flex-wrap'>
                {imagesSorted.map((x, i) => (
                    <React.Fragment key={i}>
                        <div className='flex flex-col'>
                            <div>{`${
                                typeof x.value === `number` && !Number.isInteger(x.value)
                                    ? (x.value as number).toFixed?.(2)
                                    : x.value
                            }`}</div>
                            <div>{x.imageId && <props.ui.image imageId={x.imageId} />}</div>
                        </div>
                    </React.Fragment>
                ))}
            </div>
        </div>
    )
}

type InteractiveViewState = {
    clickCount?: number
}
const InteractiveTest = (props: { value: InteractiveViewState; onChange: (value: Partial<InteractiveViewState>) => void }) => {
    const {
        value: { clickCount = 0 },
        onChange,
    } = props

    return (
        <>
            <div>Interactive Component</div>
            <div onClick={() => onChange({ clickCount: clickCount + 1 })}>value: {clickCount}</div>
            <div>Interactive Component END</div>
        </>
    )
}

// export const testHtmlContent = renderToString(<TestComponent />)

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

export const appOptimized: GlobalFunctionToDefineAnApp = ({ ui, run }) => {
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
