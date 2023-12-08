import { Runtime } from 'src'
import { ComfyWorkflowBuilder } from 'src/back/NodeBuilder'

export class StopError extends Error {
    constructor(public setFrameIndex: undefined | (() => void)) {
        super()
    }
}

export type AppState = {
    runtime: Runtime
    graph: ComfyWorkflowBuilder
    imageDirectory: string
    workingDirectory: string
    scopeStack: Record<string, unknown>[]
}

export const getNextActiveNodeIndex = (runtime: Runtime) => {
    return runtime.workflow.nodes.findLastIndex((x) => !x.disabled) + 1
}

export const disableNodesAfter = (runtime: Runtime, iNodeStartDisable: number) => {
    runtime.workflow.nodes.slice(iNodeStartDisable).forEach((x) => x.disable())
}
