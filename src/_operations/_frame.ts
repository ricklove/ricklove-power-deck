import { FormBuilder, Widget, Widget_groupOpt, Widget_group_output } from 'src'
import { WidgetDict } from 'src/cards/Card'
import { AppState, PreviewStopError, loadFromScope, storeInScope } from '../_appState'
import { createRandomGenerator } from '../_random'
import { storageOperations } from './storage'

export type Frame = {
    image: _IMAGE
    mask: _MASK
    frameId: () => number
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
