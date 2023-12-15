import { FormBuilder, Widget, Widget_groupOpt, Widget_group_output } from 'src'
import { WidgetDict } from 'src/cards/Card'
import { AppState, PreviewStopError, loadFromScope, storeInScope } from '../_appState'
import { createRandomGenerator } from '../_random'
import { storageOperations } from './storage'

export type Frame = {
    image: _IMAGE
    mask: _MASK
    frameIdProvider: ReturnType<typeof createFrameIdProvider>
}

type FrameIdsPattern = {
    startIndex: number
    iterationCount: number
    selectEveryNth?: null | number
}
export const createFrameIdProvider = (frameIdsPattern: FrameIdsPattern) => {
    const frameIds = [...new Array(frameIdsPattern.iterationCount)].map(
        (_, i) => frameIdsPattern.startIndex + i * (frameIdsPattern.selectEveryNth ?? 1),
    )

    const getBatchAtFrameIdIndex = (
        frameIds: number[],
        frameIdsPattern: FrameIdsPattern,
        iFrameId: number,
        batchSize: number,
        overlap = 0,
    ) => {
        // (batchSize:5 - len:20 - overlap:0) % 5 = 0
        // (batchSize:5 - len:21 - overlap:0) % 5 = 4
        // (batchSize:5 - len:20 - overlap:1) % 5 = 4
        const lastActiveStartOffset = (batchSize - frameIds.length - overlap) % batchSize
        const iLastActiveStart = frameIds.length - 1 - lastActiveStartOffset
        const isActive = iFrameId < iLastActiveStart ? iFrameId % batchSize === 0 : iFrameId === iLastActiveStart

        return {
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
        },
        frameIds,
        currentFrameIdIndex: 0,
        callbacks: [] as ((value: number) => void)[],
    }

    const frameIdProvider = {
        _state: state,
        subscribe: (callback: (currentFrameId: number) => void) => {
            state.callbacks.push(callback)
        },
        // setCurrentFrameId: (value: number) => {
        //     state._currentFrameId = value
        //     for (const cb of state.callbacks) {
        //         try {
        //             cb(value)
        //         } catch (err) {
        //             // ignore subscriber errors
        //             console.error(`frameIdProvider.callback error`, err)
        //         }
        //     }
        // },
        get: () => {
            return {
                frameId: state.frameIds[state.currentFrameIdIndex],
            }
        },
        iterator: {
            next: () => {
                if (state.currentFrameIdIndex < state.frameIds.length - 1) {
                    state.currentFrameIdIndex++
                    return { value: state.frameIds[state.currentFrameIdIndex]!, done: false }
                }
                return { value: undefined as unknown as number, done: true }
            },
            reset: () => {
                state.currentFrameIdIndex = 0
            },
        },
        [Symbol.iterator]() {
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
}
export const createFrameOperation = <TFields extends WidgetDict>(op: FrameOperation<TFields>): FrameOperation<TFields> => op

export const createFrameOperationValue = <TValue extends Widget>(op: {
    ui: (form: FormBuilder) => TValue
    run: (state: AppState, form: TValue['$Output'], frame: Frame) => Frame
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
                                                __loadVariables: form.groupOpt({
                                                    items: () => ({
                                                        image: form.stringOpt({ default: `a` }),
                                                        mask: form.stringOpt({ default: `a` }),
                                                    }),
                                                }),
                                                ...v.ui(form),
                                                __storeVariables: form.groupOpt({
                                                    items: () => ({
                                                        image: form.stringOpt({ default: `a` }),
                                                        mask: form.stringOpt({ default: `a` }),
                                                    }),
                                                }),
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
                    if (opGroupOptValue.__loadVariables?.image) {
                        frame.image = loadFromScope(state, opGroupOptValue.__loadVariables.image) ?? frame.image
                    }
                    if (opGroupOptValue.__loadVariables?.mask) {
                        frame.mask = loadFromScope(state, opGroupOptValue.__loadVariables.mask) ?? frame.mask
                    }

                    frame = {
                        ...frame,
                        ...op.run(state, opGroupOptValue, frame),
                    }

                    if (opGroupOptValue.__storeVariables?.image) {
                        storeInScope(state, opGroupOptValue.__storeVariables.image, `image`, frame.image)
                    }
                    if (opGroupOptValue.__storeVariables?.mask) {
                        storeInScope(state, opGroupOptValue.__storeVariables.mask, `mask`, frame.mask)
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

                        throw new PreviewStopError(undefined)
                    }
                }
            }

            return frame
        },
    })
