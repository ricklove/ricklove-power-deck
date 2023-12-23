import type { FormBuilder, Widget, Widget_groupOpt, Widget_group_output } from 'src'
import type { WidgetDict } from 'src/cards/App'
import { AppState, PreviewStopError, loadFromScope, storeInScope } from '../_appState'
import { createRandomGenerator } from '../_random'
import { observable, observe } from 'mobx'

export type Frame = {
    image: _IMAGE
    mask: _MASK
    frameIdProvider: ReturnType<typeof createFrameIdProvider>
    cache: CacheState
    workingDirectory: string
    afterFramePrompt: (() => void)[]
}

export type CacheState = {
    cacheIndex: number
    cacheIndex_run?: number
    dependencyKey: number
}

export const getCacheStore = (
    state: AppState,
    cache: CacheState,
): {
    isCached: boolean
} => {
    const storeAccess = state.runtime.Store.getOrCreate({
        key: `${cache.dependencyKey}`,
        scope: `draft`,
        makeDefaultValue: () => ({
            isCached: false,
        }),
    })

    // ideal should auto update
    // return storeAccess.getWithAutoUpdate()

    // workaround: use observer and call update manually
    // console.log(`getCacheStore: storeAccess ${cache.cacheIndex} ${cache.dependencyKey}`, { storeAccess, cache })

    const storeValue = observable(storeAccess.get())
    observe(storeValue, (x) => {
        const v = JSON.parse(JSON.stringify(x.object))
        // console.log(`getCacheStore: changed ${cache.cacheIndex} ${cache.dependencyKey}`, { v, storeValue, x })

        // manually call update
        storeAccess.update({ json: v })
    })
    return storeValue
}

export const getCacheFilePattern = (workingDirectory: string, name: string, cacheIndex: number) =>
    `${workingDirectory}/${cacheIndex.toString().padStart(4, `0`)}-${name}/#####.png`

export const calculateDependencyKey = (cache: CacheState, form: Record<string, unknown>) => {
    // console.log(`calculateDependencyKey`, { cache, form })

    const getCleanedFormObj = (o: unknown): unknown => {
        if (!o || typeof o !== `object`) {
            return o
        }

        if (Array.isArray(o)) {
            return o.map((x) => getCleanedFormObj(x))
        }

        return Object.fromEntries(
            Object.entries(o)
                .filter(([k, v]) => ![`preview`, `cache`, `seed`].some((x) => k.toLowerCase().includes(x)))
                .map(([k, v]) => [k, getCleanedFormObj(v)]),
        )
    }
    const formCleaned = JSON.parse(JSON.stringify(getCleanedFormObj(form)))
    const result = createRandomGenerator(`${cache.dependencyKey}:${JSON.stringify(formCleaned)}`).randomInt()

    // console.log(`calculateDependencyKey ${result} <- ${cache.dependencyKey}`, { result, formCleaned, cache, form })
    // console.log(`calculateDependencyKey ${result} <- ${cache.dependencyKey}`, JSON.stringify(formCleaned))
    return result
}

type FrameIdsPattern = {
    startIndex: number
    iterationCount: number
    selectEveryNth?: null | number
    repeatCount?: null | number
}
export const createFrameIdProvider = (frameIdsPattern: FrameIdsPattern) => {
    const frameIds = [...new Array(frameIdsPattern.iterationCount)].map(
        (_, i) =>
            frameIdsPattern.startIndex +
            Math.floor(i / (frameIdsPattern.repeatCount ?? 1)) * (frameIdsPattern.selectEveryNth ?? 1),
    )

    const getBatchAtFrameIdIndex = (
        frameIds: number[],
        frameIdsPattern: FrameIdsPattern,
        iFrameId: number,
        batchSize: number,
        overlap = 0,
    ) => {
        // batchSize:5, len:20 => 0-4,5-9,10-14,15-19 (iLastActive = 15)
        // batchSize:5, len:19 => 0-4,5-9,10-14,14-18 (iLastActive = 14)
        // batchSize:6, overlap:1, len:20 => 0-5,5-10,10-15,14-19 (iLastActive = 14)
        // batchSize:7, len:3 => 0-2 (iLastActive = 0)
        const iLastActive = Math.max(0, frameIds.length - batchSize)
        const b = Math.max(1, batchSize - overlap)
        const isActive = iFrameId < iLastActive ? iFrameId % b === 0 : iFrameId === iLastActive

        return {
            _iFrameId: iFrameId,
            isActive,
            startFrameId: frameIds[iFrameId],
            count: Math.min(batchSize, frameIds.length - iFrameId),
            selectEveryNth: frameIdsPattern.selectEveryNth ?? 1,
        }
    }

    const state = {
        frameIdsPattern: {
            startIndex: frameIdsPattern.startIndex,
            iterationCount: frameIdsPattern.iterationCount,
            selectEveryNth: frameIdsPattern.selectEveryNth,
            repeatCount: frameIdsPattern.repeatCount,
        },
        frameIds,
        currentFrameIdIndex: -1,
        callbacks: [] as ((value: number) => void)[],
    }

    const setCurrentFrameIdIndex = (frameIdIndex: number) => {
        console.log(`frameIdProvider: setCurrentFrameIdIndex()`, JSON.parse(JSON.stringify({ frameIdIndex, state })))

        state.currentFrameIdIndex = frameIdIndex
        const value = state.frameIds[state.currentFrameIdIndex]
        for (const cb of state.callbacks) {
            try {
                cb(value)
            } catch (err) {
                // ignore subscriber errors
                console.error(`frameIdProvider: callback error`, err)
            }
        }
    }

    const frameIdProvider = {
        _state: state,
        subscribe: (callback: (currentFrameId: number) => void) => {
            state.callbacks.push(callback)
        },

        get: () => {
            return {
                frameId: state.frameIds[state.currentFrameIdIndex],
                firstFrameId: state.frameIds[0],
                lastFrameId: state.frameIds[state.frameIds.length - 1],
                currentFrameIdIndex: state.currentFrameIdIndex,
                frameCount: state.frameIds.length,
            }
        },
        iterator: {
            next: () => {
                console.log(`frameIdProvider: next()`, JSON.parse(JSON.stringify({ state })))
                if (state.currentFrameIdIndex < state.frameIds.length - 1) {
                    setCurrentFrameIdIndex(state.currentFrameIdIndex + 1)
                    return { value: state.frameIds[state.currentFrameIdIndex]!, done: false }
                }
                return { value: undefined as unknown as number, done: true }
            },
            reset: () => {
                console.log(`frameIdProvider: reset()`, JSON.parse(JSON.stringify({ state })))
                state.currentFrameIdIndex = -1
            },
        },
        [Symbol.iterator]() {
            console.log(`frameIdProvider: [Symbol.iterator]()`, JSON.parse(JSON.stringify({ state })))
            frameIdProvider.iterator.reset()
            return frameIdProvider.iterator
        },
        getBatch: (batchSize: number, overlap?: number) =>
            getBatchAtFrameIdIndex(state.frameIds, state.frameIdsPattern, state.currentFrameIdIndex, batchSize, overlap),
    }
    return frameIdProvider
}

export type FrameOperation<TFields extends WidgetDict> = {
    ui: (form: FormBuilder) => TFields
    run: (state: AppState, form: { [k in keyof TFields]: TFields[k]['$Output'] }, frame: Frame) => Partial<Frame>
    options?: {
        simple?: boolean
        hidePreview?: boolean
        hideLoadVariables?: boolean
        hideStoreVariables?: boolean
        title?: () => string
    }
}
export const createFrameOperation = <TFields extends WidgetDict>(op: FrameOperation<TFields>): FrameOperation<TFields> => op

export const createFrameOperationValue = <TValue extends Widget>(op: {
    ui: (form: FormBuilder) => TValue
    run: (state: AppState, form: TValue['$Output'], frame: Frame) => Frame
}) => op

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
                                    const { simple, hidePreview, hideLoadVariables, hideStoreVariables } = v.options ?? {}
                                    const showLoadVariables = !simple && !hideLoadVariables
                                    const showStoreVariables = !simple && !hideStoreVariables
                                    const showPreview = !simple && !hidePreview

                                    return [
                                        k,
                                        form.group({
                                            items: () => ({
                                                ...(!showLoadVariables
                                                    ? {}
                                                    : {
                                                          __loadVariables: form.group({
                                                              className: `text-xs`,
                                                              label: false,
                                                              items: () => ({
                                                                  loadVariables: form.groupOpt({
                                                                      items: () => ({
                                                                          image: form.stringOpt({}),
                                                                          mask: form.stringOpt({}),
                                                                      }),
                                                                  }),
                                                              }),
                                                          }),
                                                      }),

                                                ...v.ui(form),
                                                ...(!showStoreVariables
                                                    ? {}
                                                    : {
                                                          __storeVariables: form.group({
                                                              className: `text-xs`,
                                                              label: false,
                                                              items: () => ({
                                                                  storeVariables: form.groupOpt({
                                                                      items: () => ({
                                                                          image: form.stringOpt({}),
                                                                          mask: form.stringOpt({}),
                                                                      }),
                                                                  }),
                                                              }),
                                                          }),
                                                      }),
                                                ...(!showPreview
                                                    ? {}
                                                    : {
                                                          __preview: form.inlineRun({}),
                                                      }),
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

            for (const listItem of form) {
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

                    frame = { ...frame }
                    const { loadVariables } = opGroupOptValue.__loadVariables ?? {}
                    if (loadVariables?.image) {
                        frame.image = loadFromScope(state, loadVariables.image) ?? frame.image
                    }
                    if (loadVariables?.mask) {
                        frame.mask = loadFromScope(state, loadVariables.mask) ?? frame.mask
                    }

                    frame = {
                        ...frame,
                        cache: {
                            ...frame.cache,
                            dependencyKey: calculateDependencyKey(frame.cache, opGroupOptValue),
                        },
                    }
                    frame = {
                        ...frame,
                        ...op.run(state, opGroupOptValue, frame),
                    }

                    const { storeVariables } = opGroupOptValue.__storeVariables ?? {}

                    if (storeVariables?.image) {
                        storeInScope(state, storeVariables.image, `image`, frame.image)
                    }
                    if (storeVariables?.mask) {
                        storeInScope(state, storeVariables.mask, `mask`, frame.mask)
                    }

                    if (opGroupOptValue.__preview) {
                        graph.PreviewImage({
                            images: graph.ImageBatch({
                                image1: graph.MaskToImage({ mask: frame.mask }),
                                image2: graph.ImageBatch({
                                    image1: graph.ImageBlend({
                                        image1: frame.image,
                                        image2: graph.MaskToImage({ mask: frame.mask }),
                                        blend_mode: `normal`,
                                        blend_factor: 0.5,
                                    }),
                                    image2: frame.image,
                                }),
                            }),
                        })

                        throw new PreviewStopError({
                            previewCount: !frame.afterFramePrompt ? 3 : undefined,
                            afterFramePrompt: frame.afterFramePrompt,
                        })
                    }
                }
            }

            return frame
        },
    })
