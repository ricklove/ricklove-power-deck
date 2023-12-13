import {
    createFrameOperation,
    createFrameOperationValue,
    createFrameOperationsChoiceList,
    createFrameOperationsGroupList,
} from './_frame'
import { imageOperations, imageOperationsList } from './image'
import { maskOperations, maskOperationsList } from './mask'

// const operation = createFrameOperation({
//     ui: (form) => ({
//         operation: form.choice({
//             items: () => ({
//                 image: imageOperationsList.ui(form),
//                 mask: maskOperationsList.ui(form),
//             }),
//         }),
//     }),
//     run: (state, form, { image, mask }) => {
//         return { image, mask }
//     },
// })

export const allOperationsList = createFrameOperationsChoiceList({ ...imageOperations, ...maskOperations })
