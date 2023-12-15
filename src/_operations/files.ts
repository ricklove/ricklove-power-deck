import { PreviewStopError, loadFromScope, storeInScope } from '../_appState'
import { createFrameOperation, createFrameOperationsGroupList } from './_frame'

const saveImageFrame = createFrameOperation({
    ui: (form) => ({
        path: form.string({ default: `../input/working/#####.png` }),
    }),
    run: ({ graph }, form, { image, frameIdProvider }) => {
        const saveNode = graph.RL$_SaveImageSequence({
            images: image,
            current_frame: 0,
            path: form.path,
        })
        frameIdProvider.subscribe((v) => (saveNode.inputs.current_frame = v))
        return {}
    },
})

const loadImageFrame = createFrameOperation({
    ui: (form) => ({
        path: form.string({ default: `../input/working/#####.png` }),
    }),
    run: ({ graph }, form, { image, frameIdProvider }) => {
        const resultImageNode = graph.RL$_LoadImageSequence({
            current_frame: 0,
            path: form.path,
        })
        frameIdProvider.subscribe((v) => (resultImageNode.inputs.current_frame = v))

        return { image: resultImageNode.outputs.image }
    },
})

const cacheImageFrame = createFrameOperation({
    ui: (form) => ({
        buildCache: form.inlineRun({ text: `Cache It!!!`, kind: `special` }),
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
    run: (state, form, { image, mask, frameIdProvider }) => {
        const { graph } = state
        const createCachedImage = (name: string, image: _IMAGE) => {
            if (form.buildCache) {
                const saveNode = graph.RL$_SaveImageSequence({
                    images: image,
                    current_frame: 0,
                    path: form.path.replace(`NAME`, name),
                })
                frameIdProvider.subscribe((v) => (saveNode.inputs.current_frame = v))
                return undefined
            }
            const cachedImageNode = graph.RL$_LoadImageSequence({
                current_frame: 0,
                path: form.path.replace(`NAME`, name),
            })
            frameIdProvider.subscribe((v) => (cachedImageNode.inputs.current_frame = v))

            return cachedImageNode.outputs.image
        }
        const createCachedMask = (name: string, mask: _MASK) => {
            if (form.buildCache) {
                const saveNode = graph.RL$_SaveImageSequence({
                    images: graph.MaskToImage({ mask }),
                    current_frame: 0,
                    path: form.path.replace(`NAME`, name),
                })
                frameIdProvider.subscribe((v) => (saveNode.inputs.current_frame = v))
                return undefined
            }
            const cachedImageNode = graph.RL$_LoadImageSequence({
                current_frame: 0,
                path: form.path.replace(`NAME`, name),
            })
            frameIdProvider.subscribe((v) => (cachedImageNode.inputs.current_frame = v))

            const cachedMask = graph.Image_To_Mask({
                image: cachedImageNode,
                method: `intensity`,
            }).outputs.MASK
            return cachedMask
        }

        const resultImage = !form.image ? undefined : createCachedImage(form.image, image)
        for (const k of form.imageVariables) {
            const variableImage = loadFromScope<_IMAGE>(state, k)
            if (!variableImage) {
                continue
            }
            storeInScope(state, k, `image`, createCachedImage(k, variableImage) ?? variableImage)
        }

        const resultMask = !form.mask ? undefined : createCachedMask(form.mask, mask)
        for (const k of form.maskVariables) {
            const variableMask = loadFromScope<_MASK>(state, k)
            if (!variableMask) {
                continue
            }
            storeInScope(state, k, `mask`, createCachedMask(k, variableMask) ?? variableMask)
        }

        if (form.buildCache) {
            throw new PreviewStopError(() => {})
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
