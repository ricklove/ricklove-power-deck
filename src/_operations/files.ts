import { PreviewStopError, getAllScopeKeys, loadFromScope, loadFromScopeWithExtras, storeInScope } from '../_appState'
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

const cacheEverything = createFrameOperation({
    options: { simple: true },
    ui: (form) => ({
        buildCache: form.inlineRun({ text: `Cache Me If You Can!`, kind: `special` }),
        // path: form.string({ default: `../input/working/NAME/#####.png` }),
        // image: form.strOpt({ default: `imageFinal` }),
        // imageVariables: form.list({
        //     element: () => form.string({ default: `imageVariable` }),
        // }),
        // mask: form.strOpt({ default: `maskFinal` }),
        // maskVariables: form.list({
        //     element: () => form.string({ default: `maskVariable` }),
        // }),
    }),
    run: (state, form, { image, mask, frameIdProvider, cacheIndex, workingDirectory }) => {
        const { graph } = state
        const pathPattern = `${workingDirectory}/NAME/#####.png`

        const previewImages = true

        const createCachedImage = (name: string, image: _IMAGE) => {
            if (form.buildCache) {
                const saveNode = graph.RL$_SaveImageSequence({
                    images: image,
                    current_frame: 0,
                    path: pathPattern.replace(`NAME`, name),
                })
                if (previewImages) {
                    graph.PreviewImage({ images: image })
                }
                frameIdProvider.subscribe((v) => (saveNode.inputs.current_frame = v))
                return undefined
            }
            const cachedImageNode = graph.RL$_LoadImageSequence({
                current_frame: 0,
                path: pathPattern.replace(`NAME`, name),
            })
            frameIdProvider.subscribe((v) => (cachedImageNode.inputs.current_frame = v))

            return cachedImageNode.outputs.image
        }
        const createCachedMask = (name: string, mask: _MASK) => {
            if (form.buildCache) {
                const maskImage = graph.MaskToImage({ mask })
                const saveNode = graph.RL$_SaveImageSequence({
                    images: maskImage,
                    current_frame: 0,
                    path: pathPattern.replace(`NAME`, name),
                })
                if (previewImages) {
                    graph.PreviewImage({ images: maskImage })
                }
                frameIdProvider.subscribe((v) => (saveNode.inputs.current_frame = v))
                return undefined
            }
            const cachedImageNode = graph.RL$_LoadImageSequence({
                current_frame: 0,
                path: pathPattern.replace(`NAME`, name),
            })
            frameIdProvider.subscribe((v) => (cachedImageNode.inputs.current_frame = v))

            const cachedMask = graph.Image_To_Mask({
                image: cachedImageNode,
                method: `intensity`,
            }).outputs.MASK
            return cachedMask
        }

        const namePrefix = `${cacheIndex.toString().padStart(4, `0`)}`

        const resultImage = createCachedImage(`${namePrefix}-image`, image)
        const resultMask = createCachedMask(`${namePrefix}-mask`, mask)

        const allScopeKeys = getAllScopeKeys(state)

        for (const k of allScopeKeys) {
            const v = loadFromScopeWithExtras(state, k)
            if (!v?.value || v.isCache) {
                continue
            }
            if (v.kind === `image`) {
                storeInScope(state, k, `image`, createCachedImage(`${namePrefix}-${k}`, v.value as _IMAGE) ?? v.value, {
                    isCache: true,
                })
                continue
            }
            if (v.kind === `mask`) {
                storeInScope(state, k, `mask`, createCachedMask(`${namePrefix}-${k}`, v.value as _MASK) ?? v.value, {
                    isCache: true,
                })
                continue
            }
        }

        if (form.buildCache) {
            throw new PreviewStopError(() => {})
        }

        return { image: resultImage, mask: resultMask, cacheIndex: cacheIndex + 1 }
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
    cacheEverything,
    // loadImageVariable,
    // storeImageVarible,
    // storeMaskVariable,
    // loadMaskVariable,
    // loadVariables,
    // storeVariables,
}
export const fileOperationsList = createFrameOperationsGroupList(fileOperations)
