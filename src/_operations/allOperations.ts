import { createFrameOperationsChoiceList } from './_frame'
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
