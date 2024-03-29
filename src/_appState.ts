import { Runtime } from 'src'
import { ComfyWorkflowBuilder } from 'src/back/NodeBuilder'
import { WidgetDict } from 'src/cards/App'
import { ComfyNode } from 'src/core/ComfyNode'

export class PreviewStopError extends Error {
    constructor(
        public options?: {
            previewCount?: number
            isAutoCache?: boolean
            cacheIndex?: number
            cacheIndex_run?: number
            cachedAlready?: boolean
            afterFramePrompt?: undefined | (() => void)[]
        },
    ) {
        super()
    }
}

export type ScopeStackValueType = _IMAGE | _MASK
export type ScopeStackValueKind = `image` | `mask`
export type ScopeStackValueData<T extends null | ScopeStackValueType = ScopeStackValueType> = {
    value: T
    kind: ScopeStackValueKind
    cacheIndex?: number
}
export type AppState<FIELDS extends WidgetDict = any> = {
    runtime: Runtime<FIELDS>
    graph: ComfyWorkflowBuilder
    scopeStack: Record<string, undefined | ScopeStackValueData>[]
}

export const getNextActiveNodeIndex = (runtime: Runtime) => {
    return runtime.workflow.nodes.findLastIndex((x) => !x.disabled) + 1
}

export const setNodesDisabled = (runtime: Runtime, disabled: boolean, iNodeStart: number, count: number) => {
    runtime.workflow.nodes.slice(iNodeStart, iNodeStart + count).forEach((x) => (x.disabled = disabled))
}

export const disableNodesAfterInclusive = (
    runtime: Runtime,
    iNodeStartDisable: number,
    filter?: (x: ComfyNode<any>) => boolean,
) => {
    runtime.workflow.nodes
        .slice(iNodeStartDisable)
        .filter((x) => filter?.(x) ?? true)
        .forEach((x) => x.disable())
}

export const getEnabledNodeNames = (runtime: Runtime) => {
    return {
        enabledNodes: runtime.workflow.nodes.filter((x) => !x.disabled).map((x) => x.$schema.nameInCushy),
        disabledNodes: runtime.workflow.nodes.filter((x) => x.disabled).map((x) => x.$schema.nameInCushy),
    }
}

export const storeInScope = <T extends null | ScopeStackValueType>(
    state: AppState,
    name: string,
    kind: ScopeStackValueKind,
    value: T,
    extra?: { cacheIndex?: number },
) => {
    const { scopeStack } = state
    scopeStack[scopeStack.length - 1][name] = value == undefined ? undefined : { value: value, kind, ...extra }

    // state.runtime.output_text(`'${name}' ${kind} stored`)
    console.log(`storeInScope`, { name, kind, extra, scopeStack })
}

export const loadFromScope = <T extends null | ScopeStackValueType>(state: AppState, name: string): undefined | T => {
    const { scopeStack } = state

    let i = scopeStack.length
    while (i >= 0) {
        const { value: v } = scopeStack[scopeStack.length - 1][name] ?? {}
        if (v !== undefined) {
            return v as T
        }
        i--
    }

    return undefined
}

export const loadFromScopeWithExtras = <T extends null | ScopeStackValueType>(
    state: AppState,
    name: string,
): undefined | ScopeStackValueData<T> => {
    const { scopeStack } = state

    let i = scopeStack.length
    while (i >= 0) {
        const v = scopeStack[scopeStack.length - 1][name] ?? {}
        if (v) {
            return v as ScopeStackValueData<T>
        }
        i--
    }

    return undefined
}

export const getAllScopeKeys = (state: AppState) => {
    return [...new Set(state.scopeStack.flatMap((x) => Object.keys(x)))]
}
