import { PreviewStopError, getAllScopeKeys, loadFromScopeWithExtras, storeInScope } from '../_appState'
import { createFrameOperation, getCacheFilePattern, getCacheStore } from './_frame'
import { disableUnusedGraph } from './_graph'

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

// TODO: automate caching
// - cacheAfter option
// - cache unnamed image and mask
const cacheEverything = createFrameOperation({
    options: { simple: true },
    ui: (form) => ({
        cache: form.group({
            label: false,
            layout: `H`,
            items: () => ({
                buildCache: form.inlineRun({ text: `Cache Me If You Can!`, kind: `special` }),
                rebuildCache: form.inlineRun({ text: `Do it again!`, kind: `special` }),
            }),
        }),
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
    run: (state, formRaw, { image, mask, frameIdProvider, cache, workingDirectory }) => {
        const { graph } = state
        const previewImages = true
        const { cacheIndex, dependencyKey } = cache
        const cacheStore = getCacheStore(state, cache)

        const form = formRaw.cache
        const isManualTrigger = form.rebuildCache || form.buildCache
        const buildCacheTriggered = form.rebuildCache || form.buildCache || cache.cacheIndex === cache.cacheIndex_run
        const shouldBuildCache =
            form.rebuildCache || ((form.buildCache || cache.cacheIndex === cache.cacheIndex_run) && !cacheStore.isCached)
        // if (!cacheStore.isCached) {
        //     // invalidate dependency key if cache is stale
        //     cache.dependencyKey += 10000
        // }

        // const cacheStore = state.runtime.store
        //     .getOrCreate({
        //         key: `${cacheIndex}`,
        //         // key: `${dependencyKey}`,
        //         scope: `draft`,
        //         makeDefaultValue: () => ({
        //             dependencyKeys: {} as { [dependencyKey: string]: { isCached: boolean; timestamp: Date } },
        //             // isCached: false,
        //         }),
        //     })
        //     .get()
        // console.log(`cacheEverything`, { cacheStore, values: state.runtime.formInstance.state.values })
        // state.runtime.formInstance.state.values.buildCache.input.kind = cacheStore.isCached ? `special` : `warning`

        const createCachedImage = (name: string, image: _IMAGE) => {
            if (shouldBuildCache) {
                const saveNode = graph.RL$_SaveImageSequence({
                    images: image,
                    current_frame: 0,
                    path: getCacheFilePattern(workingDirectory, name, cacheIndex),
                })
                if (previewImages) {
                    graph.PreviewImage({ images: image })
                }
                frameIdProvider.subscribe((v) => (saveNode.inputs.current_frame = v))
                return undefined
            }
            const cachedImageNode = graph.RL$_LoadImageSequence({
                current_frame: 0,
                path: getCacheFilePattern(workingDirectory, name, cacheIndex),
            })
            frameIdProvider.subscribe((v) => (cachedImageNode.inputs.current_frame = v))

            return cachedImageNode.outputs.image
        }
        const createCachedMask = (name: string, mask: _MASK) => {
            if (shouldBuildCache) {
                const maskImage = graph.MaskToImage({ mask })
                const saveNode = graph.RL$_SaveImageSequence({
                    images: maskImage,
                    current_frame: 0,
                    path: getCacheFilePattern(workingDirectory, name, cacheIndex),
                })
                if (previewImages) {
                    graph.PreviewImage({ images: maskImage })
                }
                frameIdProvider.subscribe((v) => (saveNode.inputs.current_frame = v))
                return undefined
            }
            const cachedImageNode = graph.RL$_LoadImageSequence({
                current_frame: 0,
                path: getCacheFilePattern(workingDirectory, name, cacheIndex),
            })
            frameIdProvider.subscribe((v) => (cachedImageNode.inputs.current_frame = v))

            const cachedMask = graph.Image_To_Mask({
                image: cachedImageNode,
                method: `intensity`,
            }).outputs.MASK
            return cachedMask
        }

        const resultImage = createCachedImage(`image`, image)
        const resultMask = createCachedMask(`mask`, mask)

        const allScopeKeys = getAllScopeKeys(state)

        for (const k of allScopeKeys) {
            const v = loadFromScopeWithExtras(state, k)
            if (!v?.value || v.cacheIndex != undefined) {
                continue
            }
            if (v.kind === `image`) {
                storeInScope(state, k, `image`, createCachedImage(k, v.value as _IMAGE) ?? v.value, {
                    cacheIndex,
                })
                continue
            }
            if (v.kind === `mask`) {
                storeInScope(state, k, `mask`, createCachedMask(k, v.value as _MASK) ?? v.value, {
                    cacheIndex,
                })
                continue
            }
        }

        if (buildCacheTriggered) {
            if (form.buildCache && cacheStore.isCached) {
                state.runtime.output_text({
                    title: `already cached!`,
                    message: `[${cache.cacheIndex}] cache is already cached!\n\ndependencyKey=${dependencyKey}`,
                })
            }

            cacheStore.isCached = true
            throw new PreviewStopError({
                //
                isAutoCache: !isManualTrigger,
                cacheIndex,
                cacheIndex_run: cache.cacheIndex_run,
                cachedAlready: !shouldBuildCache,
            })
        }

        if (!cacheStore.isCached) {
            state.runtime.output_text({
                title: `stale cache!`,
                message: `[${cache.cacheIndex}] cache is stale!\n\ndependencyKey=${dependencyKey}\n\n${JSON.stringify(
                    form,
                    null,
                    2,
                )}`,
            })
        }

        disableUnusedGraph(state, { keepNodes: { resultImage, resultMask }, keepScopeNodes: true })
        return {
            image: resultImage,
            mask: resultMask,
            cache: {
                ...cache,
                cacheIndex: cacheIndex + 1,
                dependencyKey,
            },
        }
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
