import { FormBuilder, Widget, Widget_groupOpt, Widget_group_output } from 'src'
import { WidgetDict } from 'src/cards/Card'
import { AppState, PreviewStopError } from '../_appState'
import { createRandomGenerator } from '../_random'
import { Frame, FrameOperation } from './_frame'

type FrameCached = Frame & {
    cacheStepIndex_current: number
    cacheStepIndex_stop: number
    cacheFrameId: number
}
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
export const createFrameOperationValue_cached = <TValue extends Widget>(op: {
    ui: (form: FormBuilder) => TValue
    run: (state: AppStateWithCache, form: TValue['$Output'], frame: FrameCached) => FrameCached
}) => op

export const createFrameOperationsChoiceList_cached = <TOperations extends Record<string, FrameOperation<any>>>(
    operations: TOperations,
) =>
    createFrameOperationValue_cached({
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
                // const shouldCache = Object.entries(x).some(([k, v]) => v?.__cache)
                const shouldCache = true
                const cacheStepIndex = !shouldCache
                    ? opCacheState.cacheStepIndex
                    : (opCacheState.cacheStepIndex = opCacheState.cacheStepIndex + 1)
                const isCached = state.cacheState.exists(cacheStepIndex, dependencyKey, frame.cacheFrameId)

                return {
                    item: x,
                    dependencyKey,
                    cacheStepIndex,
                    shouldCache,
                    isCached,
                }
            })
            const opStatesWithRequired = opStates.map((x, i) => ({
                ...x,
                isRequired: !opStates[i + 1]?.isCached,
                isLast: i === opStates.length - 1,
            }))

            // console.log(`createFrameOperationsChoiceList:opStates ${frame.cacheStepIndex_stop}@${frame.cacheFrameId}`, {
            //     opStatesWithRequired,
            // })

            for (const {
                item: listItem,
                dependencyKey,
                isCached,
                cacheStepIndex,
                shouldCache,
                isLast,
                isRequired,
            } of opStatesWithRequired) {
                if (isCached) {
                    if (isRequired) {
                        const cacheResult = state.cacheState.get(cacheStepIndex, dependencyKey, frame.cacheFrameId)
                        if (!cacheResult) {
                            throw new Error(
                                `Cache is missing, but reported as existing ${JSON.stringify({ cacheStepIndex, listItem })}`,
                            )
                        }
                        frame = { ...frame, ...cacheResult.frame }
                        state.scopeStack = cacheResult.scopeStack
                    }

                    if (cacheStepIndex >= frame.cacheStepIndex_stop) {
                        throw new CacheStopError(() => {}, true)
                    }

                    continue
                }

                console.log(`createFrameOperationsChoiceList: NOT CACHED ${frame.cacheStepIndex_stop}@${frame.cacheFrameId}`, {
                    opStatesWithRequired,
                })

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

                if (shouldCache) {
                    // save the cache
                    const { onCacheCreated } = state.cacheState.set(cacheStepIndex, dependencyKey, frame.cacheFrameId, {
                        frame,
                        scopeStack: state.scopeStack,
                    })

                    frame = {
                        ...frame,
                        cacheStepIndex_current: cacheStepIndex,
                    }
                    if (cacheStepIndex >= frame.cacheStepIndex_stop) {
                        throw new CacheStopError(onCacheCreated, false)
                    }
                }
            }

            return frame
        },
    })
