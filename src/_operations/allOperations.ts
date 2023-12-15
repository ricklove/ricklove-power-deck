import { createFrameOperationsChoiceList } from './_frame'
import { createFrameOperationsChoiceList_cached } from './_frameCached'
import { imageOperations } from './image'
import { maskOperations } from './mask'
import { resizingOperations } from './resizing'
import { storageOperations } from './storage'

export const allOperationsList = createFrameOperationsChoiceList({
    ...imageOperations,
    ...maskOperations,
    ...resizingOperations,
    ...storageOperations,
})

export const allOperationsList_cached = createFrameOperationsChoiceList_cached({
    ...imageOperations,
    ...maskOperations,
    ...resizingOperations,
    ...storageOperations,
})
