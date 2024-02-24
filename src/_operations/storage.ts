import { loadFromScope, storeInScope } from '../_appState'
import { createImageOperation } from './_frame'

const storeImageVariable = createImageOperation({
    ui: (form) => ({
        name: form.string({ default: `a` }),
    }),
    run: (state, form, { image }) => {
        storeInScope(state, form.name, `image`, image)
        return { image }
    },
})

const loadImageVariable = createImageOperation({
    ui: (form) => ({
        name: form.string({ default: `a` }),
    }),
    run: (state, form, { image }) => {
        return { image: loadFromScope<_IMAGE>(state, form.name) ?? image }
    },
})

const storeMaskVariable = createImageOperation({
    ui: (form) => ({
        name: form.string({ default: `a` }),
    }),
    run: (state, form, { image, mask }) => {
        storeInScope(state, form.name, `mask`, mask)
        return { mask }
    },
})

const loadMaskVariable = createImageOperation({
    ui: (form) => ({
        name: form.string({ default: `a` }),
    }),
    run: (state, form, { mask }) => {
        return { mask: loadFromScope<_MASK>(state, form.name) ?? mask }
    },
})

const storeVariables = createImageOperation({
    ui: (form) => ({
        image: form.stringOpt({ default: `a` }),
        mask: form.stringOpt({ default: `a` }),
    }),
    run: (state, form, { image, mask }) => {
        if (form.image) {
            storeInScope(state, form.image, `image`, image)
        }
        if (form.mask) {
            storeInScope(state, form.mask, `mask`, mask)
        }
        return {}
    },
})

const loadVariables = createImageOperation({
    ui: (form) => ({
        image: form.stringOpt({ default: `a` }),
        mask: form.stringOpt({ default: `a` }),
    }),
    run: (state, form, {}) => {
        return {
            image: form.image ? loadFromScope<_IMAGE>(state, form.image) : undefined,
            mask: form.mask ? loadFromScope<_MASK>(state, form.mask) : undefined,
        }
    },
})

export const storageOperations = {
    loadImageVariable,
    storeImageVarible: storeImageVariable,
    storeMaskVariable,
    loadMaskVariable,
    loadVariables,
    storeVariables,
}
