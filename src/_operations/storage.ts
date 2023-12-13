import { loadFromScope, storeInScope } from '../_appState'
import { createFrameOperation, createFrameOperationsGroupList } from './_frame'

const storeImageVarible = createFrameOperation({
    ui: (form) => ({
        name: form.string({ default: `a` }),
    }),
    run: (state, form, { image }) => {
        storeInScope(state, form.name, image)
        return { image }
    },
})

const loadImageVariable = createFrameOperation({
    ui: (form) => ({
        name: form.string({ default: `a` }),
    }),
    run: (state, form, { image }) => {
        return { image: loadFromScope(state, form.name) ?? image }
    },
})

const storeMaskVariable = createFrameOperation({
    ui: (form) => ({
        name: form.string({ default: `a` }),
    }),
    run: (state, form, { image, mask }) => {
        storeInScope(state, form.name, mask)
        return { mask }
    },
})

const loadMaskVariable = createFrameOperation({
    ui: (form) => ({
        name: form.string({ default: `a` }),
    }),
    run: (state, form, { mask }) => {
        return { mask: loadFromScope(state, form.name) ?? mask }
    },
})

const storeVariables = createFrameOperation({
    ui: (form) => ({
        image: form.stringOpt({ default: `a` }),
        mask: form.stringOpt({ default: `a` }),
    }),
    run: (state, form, { image, mask }) => {
        if (form.image) {
            storeInScope(state, form.image, mask)
        }
        if (form.mask) {
            storeInScope(state, form.mask, mask)
        }
        return {}
    },
})

const loadVariables = createFrameOperation({
    ui: (form) => ({
        image: form.stringOpt({ default: `a` }),
        mask: form.stringOpt({ default: `a` }),
    }),
    run: (state, form, {}) => {
        return {
            image: form.image ? loadFromScope(state, form.image) : undefined,
            mask: form.mask ? loadFromScope(state, form.mask) : undefined,
        }
    },
})

export const storageOperations = {
    loadImageVariable,
    storeImageVarible,
    storeMaskVariable,
    loadMaskVariable,
    loadVariables,
    storeVariables,
}
export const storageOperationsList = createFrameOperationsGroupList(storageOperations)
