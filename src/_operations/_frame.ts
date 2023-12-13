import { FormBuilder, Runtime, Widget, Widget_groupOpt, Widget_group_output } from 'src'
import { ComfyWorkflowBuilder } from 'src/back/NodeBuilder'
import { WidgetDict } from 'src/cards/Card'
import { AppState, StopError, storeInScope, loadFromScope } from '../_appState'

export type Frame = {
    image: _IMAGE
    mask: _MASK
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
                    throw new StopError(undefined)
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
                                            items: () => ({ ...v.ui(form), __preview: form.inlineRun({}) }),
                                        }),
                                    ]
                                }),
                            ),
                        }),
                    }),
            }),
        run: (state, form, frame) => {
            const { runtime, graph } = state

            console.log(`createFrameOperationsChoiceList: run`, { operations, form })

            for (const listItem of form) {
                const listItemGroupOptFields = listItem as unknown as Widget_group_output<
                    Record<string, Widget_groupOpt<Record<string, Widget>>>
                >
                for (const [opName, op] of Object.entries(operations)) {
                    const opGroupOptValue = listItemGroupOptFields[opName]
                    console.log(`createFrameOperationsChoiceList: loop operations`, {
                        opGroupOptValue,
                        operations,
                        listItemGroupOptFields,
                        form,
                    })

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
                        throw new StopError(undefined)
                    }
                }
            }

            return frame
        },
    })
