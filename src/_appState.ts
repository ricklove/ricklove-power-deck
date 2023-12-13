import { Runtime } from 'src'
import { ComfyWorkflowBuilder } from 'src/back/NodeBuilder'

export class StopError extends Error {
    constructor(public setFrameIndex: undefined | ((frameIndex: number) => void)) {
        super()
    }
}

export type AppState = {
    runtime: Runtime
    graph: ComfyWorkflowBuilder
    imageDirectory: string
    workingDirectory: string
    comfyUiInputRelativePath?: string
    scopeStack: Record<string, unknown>[]
}

export const getNextActiveNodeIndex = (runtime: Runtime) => {
    return runtime.workflow.nodes.findLastIndex((x) => !x.disabled) + 1
}

export const disableNodesAfterInclusive = (runtime: Runtime, iNodeStartDisable: number) => {
    runtime.workflow.nodes.slice(iNodeStartDisable).forEach((x) => x.disable())
}

export const getEnabledNodeNames = (runtime: Runtime) => {
    return {
        enabledNodes: runtime.workflow.nodes.filter((x) => !x.disabled).map((x) => x.$schema.nameInCushy),
        disabledNodes: runtime.workflow.nodes.filter((x) => x.disabled).map((x) => x.$schema.nameInCushy),
    }
}

export const storeInScope = <T extends null | Object>(state: AppState, name: string, value: T) => {
    const { scopeStack } = state
    scopeStack[scopeStack.length - 1][name] = value
}

export const loadFromScope = <T extends null | Object>(state: AppState, name: string): undefined | T => {
    const { scopeStack } = state

    let i = scopeStack.length
    while (i >= 0) {
        const v = scopeStack[scopeStack.length - 1][name]
        if (v !== undefined) {
            return v as T
        }
        i--
    }

    return undefined
}
