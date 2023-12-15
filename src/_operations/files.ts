import { loadFromScope, storeInScope } from '../_appState'
import { createFrameOperation, createFrameOperationsGroupList } from './_frame'

const saveImageFrame = createFrameOperation({
    ui: (form) => ({
        path: form.string({ default: `../input/working/#####.png` }),
    }),
    run: ({ graph }, form, { image, frameId }) => {
        graph.RL$_SaveImageSequence({
            images: image,
            current_frame: frameId,
            path: form.path,
        })
        return {}
    },
})

const loadImageFrame = createFrameOperation({
    ui: (form) => ({
        path: form.string({ default: `../input/working/#####.png` }),
    }),
    run: ({ graph }, form, { image, frameId }) => {
        const resultImage = graph.RL$_LoadImageSequence({
            current_frame: frameId,
            path: form.path,
        })
        return { image: resultImage }
    },
})

const cacheImageFrame = createFrameOperation({
    ui: (form) => ({
        path: form.string({ default: `../input/working/NAME/#####.png` }),
        image: form.strOpt({ default: `imageFinal` }),
        imageVariables: form.list({
            element: () => form.string({ default: `imageVariable` }),
        }),
        mask: form.strOpt({ default: `maskFinal` }),
        maskVariables: form.list({
            element: () => form.string({ default: `maskVariable` }),
        }),
    }),
    run: (state, form, { image, mask, frameId }) => {
        const { graph } = state
        const createCachedImage = (name: string, image: _IMAGE) => {
            graph.RL$_SaveImageSequence({
                images: image,
                current_frame: frameId,
                path: form.path.replace(`NAME`, name),
            })
            const cachedImage = graph.RL$_LoadImageSequence({
                current_frame: frameId,
                path: form.path.replace(`NAME`, name),
            })
            return cachedImage
        }
        const createCachedMask = (name: string, mask: _MASK) => {
            graph.RL$_SaveImageSequence({
                images: graph.MaskToImage({ mask }),
                current_frame: frameId,
                path: form.path.replace(`NAME`, name),
            })
            const cachedImage = graph.RL$_LoadImageSequence({
                current_frame: frameId,
                path: form.path.replace(`NAME`, name),
            })
            const cachedMask = graph.Image_To_Mask({
                image: cachedImage,
                method: `intensity`,
            })
            return cachedMask
        }

        const resultImage = !form.image ? undefined : createCachedImage(form.image, image)
        for (const k of form.imageVariables) {
            const variableImage = loadFromScope<_IMAGE>(state, k)
            if (!variableImage) {
                continue
            }
            storeInScope(state, k, `image`, createCachedImage(k, variableImage))
        }

        const resultMask = !form.mask ? undefined : createCachedMask(form.mask, mask)
        for (const k of form.maskVariables) {
            const variableMask = loadFromScope<_MASK>(state, k)
            if (!variableMask) {
                continue
            }
            storeInScope(state, k, `mask`, createCachedMask(k, variableMask))
        }

        return { image: resultImage, mask: resultMask }
    },
})

// const loadImageVariable = createFrameOperation({
//     ui: (form) => ({
//         name: form.string({ default: `a` }),
//     }),
//     run: (state, form, { image }) => {
//         return { image: loadFromScope(state, form.name) ?? image }
//     },
// })

// const storeMaskVariable = createFrameOperation({
//     ui: (form) => ({
//         name: form.string({ default: `a` }),
//     }),
//     run: (state, form, { image, mask }) => {
//         storeInScope(state, form.name, `mask`, mask)
//         return { mask }
//     },
// })

// const loadMaskVariable = createFrameOperation({
//     ui: (form) => ({
//         name: form.string({ default: `a` }),
//     }),
//     run: (state, form, { mask }) => {
//         return { mask: loadFromScope(state, form.name) ?? mask }
//     },
// })

// const storeVariables = createFrameOperation({
//     ui: (form) => ({
//         image: form.stringOpt({ default: `a` }),
//         mask: form.stringOpt({ default: `a` }),
//     }),
//     run: (state, form, { image, mask }) => {
//         if (form.image) {
//             storeInScope(state, form.image, `image`, image)
//         }
//         if (form.mask) {
//             storeInScope(state, form.mask, `mask`, mask)
//         }
//         return {}
//     },
// })

// const loadVariables = createFrameOperation({
//     ui: (form) => ({
//         image: form.stringOpt({ default: `a` }),
//         mask: form.stringOpt({ default: `a` }),
//     }),
//     run: (state, form, {}) => {
//         return {
//             image: form.image ? loadFromScope(state, form.image) : undefined,
//             mask: form.mask ? loadFromScope(state, form.mask) : undefined,
//         }
//     },
// })

export const fileOperations = {
    saveImageFrame,
    loadImageFrame,
    cacheImageFrame,
    // loadImageVariable,
    // storeImageVarible,
    // storeMaskVariable,
    // loadMaskVariable,
    // loadVariables,
    // storeVariables,
}
export const fileOperationsList = createFrameOperationsGroupList(fileOperations)
