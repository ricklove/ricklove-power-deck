import { FormBuilder, Widget, Widget_groupOpt, Widget_group_output } from 'src'
import { WidgetDict } from 'src/cards/Card'
import { AppState, PreviewStopError } from '../_appState'
import { createRandomGenerator } from '../_random'

type CacheData = { frame: Pick<Frame, `image` | `mask`>; scopeStack: AppState[`scopeStack`] }
export type AppStateWithCache = AppState & {
    cacheState: {
        exists: (cacheIndex: number, dependencyKey: string, cacheFrameId: number) => boolean
        get: (cacheIndex: number, dependencyKey: string, cacheFrameId: number) => undefined | CacheData
        set: (cacheIndex: number, dependencyKey: string, cacheFrameId: number, data: CacheData) => { onCacheCreated: () => void }
    }
}

export class CacheStopError extends Error {
    constructor(public onCacheCreated: () => void, public wasAlreadyCached: boolean) {
        super()
    }
}

export type Frame = {
    image: _IMAGE
    mask: _MASK
    cacheStepIndex_current: number
    cacheStepIndex_stop: number
    cacheFrameId: number
}
export type FrameOperation<TFields extends WidgetDict> = {
    ui: (form: FormBuilder) => TFields
    run: (state: AppStateWithCache, form: { [k in keyof TFields]: TFields[k]['$Output'] }, frame: Frame) => Partial<Frame>
}
export const createFrameOperation = <TFields extends WidgetDict>(op: FrameOperation<TFields>): FrameOperation<TFields> => op

export const createFrameOperationValue = <TValue extends Widget>(op: {
    ui: (form: FormBuilder) => TValue
    run: (state: AppStateWithCache, form: TValue['$Output'], frame: Frame) => Frame
}) => op
export const createFrameOperationsGroupList = <TOperations extends Record<string, FrameOperation<any>>>(
    operations: TOperations,
) =>
    createFrameOperationValue({
        ui: (form) =>
            form.list({
                element: () =>
                    form.group({
                        layout: 'V',
                        items: () => ({
                            ...Object.fromEntries(
                                Object.entries(operations).map(([k, v]) => {
                                    return [
                                        k,
                                        form.groupOpt({
                                            items: () => v.ui(form),
                                        }),
                                    ]
                                }),
                            ),
                            preview: form.inlineRun({}),
                        }),
                    }),
            }),
        run: (state, form, frame) => {
            const { runtime, graph } = state

            // console.log(`createFrameOperationsList run`, { operations, form })

            for (const listItem of form) {
                const listItemGroupOptFields = listItem as unknown as Widget_group_output<
                    Record<string, Widget_groupOpt<Record<string, Widget>>>
                >
                for (const [opName, op] of Object.entries(operations)) {
                    const opGroupOptValue = listItemGroupOptFields[opName]
                    // console.log(`createFrameOperationsList loop operations`, {
                    //     opGroupOptValue,
                    //     operations,
                    //     listItemGroupOptFields,
                    //     form,
                    // })

                    if (opGroupOptValue == null) {
                        continue
                    }

                    frame = {
                        ...frame,
                        ...op.run(state, opGroupOptValue, frame),
                    }
                }

                if (listItem.preview) {
                    graph.PreviewImage({ images: frame.image })
                    throw new PreviewStopError(undefined)
                }
            }

            return frame
        },
    })

export const createFrameOperationsChoiceList = <TOperations extends Record<string, FrameOperation<any>>>(
    operations: TOperations,
) =>
    createFrameOperationValue({
        ui: (form) =>
            form.list({
                element: () =>
                    form.choice({
                        items: () => ({
                            ...Object.fromEntries(
                                Object.entries(operations).map(([k, v]) => {
                                    return [
                                        k,
                                        form.group({
                                            items: () => ({
                                                ...v.ui(form),
                                                __cache: form.bool({}),
                                                __preview: form.inlineRun({}),
                                            }),
                                        }),
                                    ]
                                }),
                            ),
                        }),
                    }),
            }),
        run: (state, form, frame) => {
            const { runtime, graph } = state

            // console.log(`createFrameOperationsChoiceList: run`, { operations, form })

            const opCacheState = {
                dependencyKey: `42`,
                cacheStepIndex: frame.cacheStepIndex_current,
            }

            const opStates = form.map((x) => {
                const cleanedFormItem = {
                    ...Object.fromEntries(
                        Object.entries(x).map(([k, v]) => [
                            k,
                            !v
                                ? undefined
                                : {
                                      ...v,
                                      __cache: undefined,
                                      __preview: undefined,
                                  },
                        ]),
                    ),
                }
                const dependencyKey = (opCacheState.dependencyKey = `${createRandomGenerator(
                    `${opCacheState.dependencyKey}:${JSON.stringify(cleanedFormItem)}`,
                ).randomInt()}`)
                const shouldCache = Object.entries(x).some(([k, v]) => v?.__cache)
                // const shouldCache = true
                const cacheStepIndex = !shouldCache
                    ? opCacheState.cacheStepIndex
                    : (opCacheState.cacheStepIndex = opCacheState.cacheStepIndex + 1)
                const isStopped = cacheStepIndex >= frame.cacheStepIndex_stop
                const isCached = state.cacheState.exists(cacheStepIndex, dependencyKey, frame.cacheFrameId)

                return {
                    item: x,
                    dependencyKey,
                    cacheStepIndex,
                    isStopped,
                    shouldCache,
                    isCached,
                }
            })

            console.log(`createFrameOperationsChoiceList:opStates`, { opStates })

            const iLastCacheToUse = opStates.findLastIndex((x) => !x.isStopped && x.isCached)
            const opStatesStartingWithCached = iLastCacheToUse >= 0 ? opStates.slice(iLastCacheToUse) : opStates

            for (const {
                item: listItem,
                dependencyKey,
                isCached,
                cacheStepIndex,
                shouldCache,
                isStopped,
            } of opStatesStartingWithCached) {
                if (isCached) {
                    const cacheResult = state.cacheState.get(cacheStepIndex, dependencyKey, frame.cacheFrameId)
                    if (!cacheResult) {
                        throw new Error(
                            `Cache is missing, but reported as existing ${JSON.stringify({ cacheStepIndex, listItem })}`,
                        )
                    }
                    frame = { ...frame, ...cacheResult.frame }
                    state.scopeStack = cacheResult.scopeStack

                    if (isStopped) {
                        throw new CacheStopError(() => {}, true)
                    }

                    continue
                }

                const listItemGroupOptFields = listItem as unknown as Widget_group_output<
                    Record<string, Widget_groupOpt<Record<string, Widget>>>
                >
                for (const [opName, op] of Object.entries(operations)) {
                    const opGroupOptValue = listItemGroupOptFields[opName]
                    // console.log(`createFrameOperationsChoiceList: loop operations`, {
                    //     opGroupOptValue,
                    //     operations,
                    //     listItemGroupOptFields,
                    //     form,
                    // })

                    if (opGroupOptValue == null) {
                        continue
                    }

                    frame = {
                        ...frame,
                        ...op.run(state, opGroupOptValue, frame),
                    }

                    if (opGroupOptValue.__preview) {
                        graph.PreviewImage({ images: frame.image })
                        graph.PreviewImage({ images: graph.MaskToImage({ mask: frame.mask }) })
                        graph.PreviewImage({
                            images: graph.ImageBlend({
                                image1: frame.image,
                                image2: graph.MaskToImage({ mask: frame.mask }),
                                blend_mode: `normal`,
                                blend_factor: 0.5,
                            }),
                        })
                        throw new PreviewStopError(undefined)
                    }
                }

                if (shouldCache && !isCached) {
                    // save the cache
                    const { onCacheCreated } = state.cacheState.set(cacheStepIndex, dependencyKey, frame.cacheFrameId, {
                        frame,
                        scopeStack: state.scopeStack,
                    })

                    frame = {
                        ...frame,
                        cacheStepIndex_current: cacheStepIndex,
                    }
                    if (isStopped) {
                        throw new CacheStopError(onCacheCreated, false)
                    }
                }
            }

            return frame
        },
    })
