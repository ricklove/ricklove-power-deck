import { CustomWidgetProps } from 'src'
import { FormBuilder, Widget, Widget_floatOpt_opts, Widget_float_opts, Widget_intOpt_opts, Widget_int_opts } from 'src'
import type { GlobalFunctionToDefineAnApp } from 'src/cards/App'
import { observer } from 'mobx-react-lite'
import { Fragment } from 'react'

export type OptimizerComponentViewState = InteractiveViewState & {
    varPath?: string
    images?: {
        imageId: MediaImageID
        value: unknown
        formResults: Record<string, unknown>
        optimizedValues: { varPath: string; value: unknown }[]
    }[]
    secondarySortVarPath?: string
}

const sortUnknown = <T extends unknown>(a: T, b: T, getValue: (t: T) => unknown) => {
    const aValue = getValue(a)
    const bValue = getValue(b)
    if (typeof aValue === `number` && typeof bValue === `number`) {
        return aValue - bValue
    }

    return `${aValue}`.localeCompare(`${bValue}`)
}

export const OptimizerComponent = observer((props: CustomWidgetProps<OptimizerComponentViewState>) => {
    const {
        widget: {
            state: { value: s },
        },
    } = props
    const change = (v: Partial<OptimizerComponentViewState>) => {
        props.widget.state.value = { ...props.widget.state.value, ...v }
    }

    // TODO: Optimize this
    const secondarySortVarPaths = [...new Set(s.images?.flatMap((x) => x.optimizedValues.map((o) => o.varPath)))].filter(
        (x) => x !== s.varPath,
    )
    const secondarySortVarPath = s.secondarySortVarPath ?? secondarySortVarPaths[0]
    const imagesSorted = (s.images ?? [])?.slice().sort((a, b) => {
        const s1 = sortUnknown(a, b, (x) => x.value)
        if (s1 || !secondarySortVarPath) {
            return s1
        }

        return sortUnknown(a, b, (x) => x.optimizedValues.find((o) => o.varPath === secondarySortVarPath)?.value ?? 0)
    })
    const getBucketValue = (x: unknown): string => (typeof x === `number` ? `${Math.floor(x * 20) / 20}` : `${x}`)
    const imageGroupsMap = new Map(imagesSorted.map((x) => [getBucketValue(x.value), [] as typeof imagesSorted]))
    imagesSorted.forEach((x) => imageGroupsMap.get(getBucketValue(x.value))?.push(x))
    const imageGroups = [...imageGroupsMap.entries()].map(([k, v]) => ({ key: k, items: v }))

    const formatValue = (value: unknown) => {
        return `${typeof value === `number` && !Number.isInteger(value) ? (value as number).toFixed?.(2) : value}`
    }

    return (
        <div>
            <div>
                {secondarySortVarPaths.map((x) => (
                    <Fragment key={x}>
                        <div
                            className={`btn btn-sm ${x === secondarySortVarPath ? `btn-outline` : `btn-ghost`}`}
                            onClick={() => change({ secondarySortVarPath: x })}
                        >
                            {x}
                        </div>
                    </Fragment>
                ))}
            </div>
            {imageGroups.map((g) => (
                <Fragment key={g.key}>
                    <div className='flex flex-row flex-wrap'>
                        <div className='text-xs'>{formatValue(g.key)}</div>
                        {g.items.map((x, i) => (
                            <Fragment key={i}>
                                <div className='flex flex-col'>
                                    <div>{x.imageId && <props.extra.ImageUI img={x.imageId} />}</div>
                                    <div>
                                        {x.optimizedValues?.map((o) => (
                                            <Fragment key={o.varPath}>
                                                <div className='flex flex-row justify-between p-1'>
                                                    <div className='text-xs break-all'>{o.varPath}</div>
                                                    <div className='text-xs'>{formatValue(o.value)}</div>
                                                </div>
                                            </Fragment>
                                        ))}
                                    </div>
                                </div>
                            </Fragment>
                        ))}
                    </div>
                </Fragment>
            ))}
        </div>
    )
})

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
    formCreateNonOptional: (opts: TOpts) => TResultNonOpt,
    opts: TOpts,
    options?: { isOptional: boolean; includeMinMax?: boolean },
) => {
    return (options?.isOptional ? form.groupOpt : form.group)({
        items: () => ({
            _value: formCreateNonOptional(opts),
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
                    results: form.custom({
                        Component: OptimizerComponent,
                        defaultValue: () => ({} as OptimizerComponentViewState),
                    }),
                }),
            }),
        }),
    })
}

let autoRunsRemaining = 0
export const appOptimized: GlobalFunctionToDefineAnApp = ({ ui, run }) => {
    return app({
        ui: (form) => {
            const formBuilderCustom = {
                ...form,
                int: (opts: Widget_int_opts) => formOptimize(form, form.int, opts, { isOptional: false, includeMinMax: true }),
                intOpt: (opts: Widget_intOpt_opts) =>
                    formOptimize(form, form.int, opts, { isOptional: true, includeMinMax: true }),
                float: (opts: Widget_float_opts) =>
                    formOptimize(form, form.float, opts, { isOptional: false, includeMinMax: true }),
                floatOpt: (opts: Widget_floatOpt_opts) =>
                    formOptimize(form, form.float, opts, { isOptional: true, includeMinMax: true }),
            }

            const uiResult = ui(formBuilderCustom as unknown as FormBuilder)
            return {
                ...uiResult,
                clearOptimization: form.inlineRun({ kind: `warning` }),
            } as typeof uiResult
        },
        run: async (runtime, formResultsRaw) => {
            const currentDraft = runtime.st.currentDraft
            const formSerial = runtime.formSerial

            if (formResultsRaw.clearOptimization) {
                const clearOptimizationRecursive = (n: unknown) => {
                    if (!n || !(typeof n === `object`)) {
                        return
                    }

                    if (Array.isArray(n)) {
                        for (const x of n) {
                            clearOptimizationRecursive(x)
                        }
                        return
                    }

                    if (`_optimize` in n) {
                        const nTyped = n as {
                            _optimize: {
                                values_: {
                                    results: {
                                        value: undefined | OptimizerComponentViewState
                                    }
                                }
                            }
                        }
                        nTyped._optimize.values_.results.value = undefined
                        return
                    }

                    for (const x of Object.values(n)) {
                        clearOptimizationRecursive(x)
                    }
                }

                clearOptimizationRecursive(formSerial)

                return
            }

            const optimizationState = {
                count: 1,
            }
            const optimizedValues = [] as {
                varPath: string[]
                value: unknown
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

                // console.log(`appOptimized: random normal value`, {
                //     min,
                //     max,
                //     value,
                //     v,
                //     vRaw: JSON.parse(JSON.stringify(vRaw)),
                // })

                optimizedValues.push({ varPath, value })
                return value as typeof v
            }

            let formResults = injectOptimizedValue(formResultsRaw, [])

            // console.log(`appOptimized injected optimized values`, {
            //     formResultsRaw: JSON.parse(JSON.stringify(formResultsRaw)),
            //     formResults: JSON.parse(JSON.stringify(formResults)),
            //     formSerial: JSON.parse(JSON.stringify(formSerial)),
            // })

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
                                value: OptimizerComponentViewState
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
                    formSerialOptimizeValue.results.value.images = []
                    formSerialOptimizeValue.results.value = { ...formSerialOptimizeValue.results.value }
                    return
                }
            }

            // console.log(`appOptimized running`, {
            //     optimizedValues,
            //     autoRunsRemaining,
            // })

            await run(runtime, formResults as unknown as typeof formResultsRaw)

            const generatedOutputIds = runtime.step.generatedImages.map((x) => x?.id ?? ``).filter((x) => x)

            // console.log(`appOptimized ran`, {
            //     optimizedValues,
            //     generatedOutputIds,
            //     generatedImages: runtime.step.generatedImages,
            // })

            // const formResultId = runtime.

            const formResultsObj = JSON.parse(JSON.stringify(formResults)) as Record<string, unknown>
            // formResultsJson.__id = nanoid()
            optimizedValues.forEach((x) => {
                const { formResultValue, formSerialOptimizeValue, formResultRawValue } = navigateToOptimizationVar(x.varPath)

                if (!formResultRawValue._optimize) {
                    return
                }

                const usedValue = formResultValue as unknown

                const compValue = formSerialOptimizeValue.results.value ?? {}
                // compValue.formResults = [...(compValue.formResults ?? []), formResultsJson]
                compValue.images = [
                    ...(compValue.images ?? []),
                    ...generatedOutputIds
                        .filter((x) => !compValue.images?.some((y) => y.imageId === x))
                        .map((x) => ({
                            value: usedValue,
                            formResults: formResultsObj,
                            optimizedValues: optimizedValues.map((x) => ({ ...x, varPath: x.varPath.join(`.`) })),
                            imageId: x,
                        })),
                ]
                compValue.varPath = x.varPath.join(`.`)
                formSerialOptimizeValue.results.value = { ...compValue }

                // console.log(`optimizedValues forEach`, {
                //     usedValue,
                //     formResultValue,
                //     formSerialOptimizeValue,
                //     x,
                //     formResults,
                //     formSerial: JSON.parse(JSON.stringify(formSerial)),
                // })
            })

            if (autoRunsRemaining > 0) {
                autoRunsRemaining--
            } else if (optimizationState.count > 1) {
                autoRunsRemaining = optimizationState.count - 1
            }
            if (autoRunsRemaining > 0) {
                setTimeout(() => {
                    currentDraft?.start()
                }, 100)
            }
        },
    })
}
