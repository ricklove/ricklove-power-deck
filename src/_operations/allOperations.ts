import { createFrameOperation, createFrameOperationsChoiceList } from './_frame'
import { imageOperations } from './image'
import { maskOperations } from './mask'
import { resizingOperations } from './resizing'
import { storageOperations } from './storage'
import { samplingOperations } from './sampling'
import { fileOperations } from './files'
import { videoOperations } from './video'
import { outputOperations } from './output'
import { zeroOperations } from './zero123'
import { faceOperations } from './face'
import { interactiveOperations } from './interactive'

const divider = createFrameOperation({
    ui: (form) => ({}),
    run: ({ runtime, graph }, form, { image }) => {
        return {}
    },
})

const alloperations = {
    ...imageOperations,
    ...maskOperations,
    ...resizingOperations,
    ...storageOperations,
    ...samplingOperations,
    ...fileOperations,
    ...videoOperations,
    ...zeroOperations,
    ...faceOperations,
    ...outputOperations,
    ...interactiveOperations,
}

const subOperationsInner = createFrameOperationsChoiceList({
    ...alloperations,
})

const subOperations = createFrameOperation({
    options: {
        simple: true,
    },
    ui: (form) => ({
        subOperations: subOperationsInner.ui(form),
        ...fileOperations.cacheEverything.ui(form),
    }),
    run: (state, form, frame) => {
        const result = subOperationsInner.run(state, form.subOperations, frame)
        const cacheResult = fileOperations.cacheEverything.run(state, form, result)
        return cacheResult
    },
})

export const allOperationsList = createFrameOperationsChoiceList({
    ...alloperations,
    subOperations,
})
