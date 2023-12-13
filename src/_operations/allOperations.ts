import { createFrameOperationsChoiceList } from './_frame'
import { imageOperations } from './image'
import { maskOperations } from './mask'
import { resizingOperations } from './resizing'

export const allOperationsList = createFrameOperationsChoiceList({
    ...imageOperations,
    ...maskOperations,
    ...resizingOperations,
})
