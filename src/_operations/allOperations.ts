import { createFrameOperation, createFrameOperationsChoiceList } from './_frame'
import { createFrameOperationsChoiceList_cached } from './_frameCached'
import { imageOperations } from './image'
import { maskOperations } from './mask'
import { resizingOperations } from './resizing'
import { storageOperations } from './storage'
import { samplingOperations } from './sampling'
import { fileOperations } from './files'
import { videoOperations } from './video'

const divider = createFrameOperation({
    ui: (form) => ({}),
    run: ({ runtime, graph }, form, { image }) => {
        return {}
    },
})

export const allOperationsList = createFrameOperationsChoiceList({
    ...imageOperations,
    ...maskOperations,
    ...resizingOperations,
    ...storageOperations,
    ...samplingOperations,
    ...fileOperations,
    ...videoOperations,
    [`---`]: divider,
})

export const allOperationsList_cached = createFrameOperationsChoiceList_cached({
    ...imageOperations,
    ...maskOperations,
    ...resizingOperations,
    ...storageOperations,
    ...samplingOperations,
    ...fileOperations,
    ...videoOperations,
    [`---`]: divider,
})
