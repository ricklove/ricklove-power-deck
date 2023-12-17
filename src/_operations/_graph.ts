import { AppState, getAllScopeKeys, loadFromScope } from '../_appState'

export const disableUnusedGraph = (
    state: AppState,
    { keepNodes, keepScopeNodes }: { keepNodes: Record<string, unknown>; keepScopeNodes: boolean },
) => {
    const nodesIndex = state.runtime.workflow.nodesIndex
    const findInputNodeIds = (o: unknown, path: string[]): { nodeId: string; path: string[] }[] => {
        if (!o) {
            return []
        }
        if (typeof o !== `object`) {
            return []
        }
        if (`node` in o) {
            return findInputNodeIds(o.node, [...path, `node`])
        }

        if (`uid` in o) {
            const nodeId = { nodeId: o.uid as string, path: [...path, `uid[${o.uid}]`] }
            if (`_incomingNodes` in o && typeof o._incomingNodes === `function`) {
                const incomingNodes = o._incomingNodes() as string[]
                const ancestors = incomingNodes.flatMap((x) =>
                    findInputNodeIds(nodesIndex.get(x), [...nodeId.path, `_incomingNodes()`]),
                )
                return [nodeId, ...ancestors]
            }

            return [nodeId]
        }
        console.log(`disableUnusedGraph: findInputNodeIds: unknown`, {
            o,
        })
        return []
    }

    const allScopeValues = !keepScopeNodes ? [] : getAllScopeKeys(state).map((k) => ({ value: loadFromScope(state, k), key: k }))
    const nodesIdPaths = [...Object.entries(keepNodes).map(([k, v]) => ({ key: k, value: v })), ...allScopeValues].flatMap((x) =>
        findInputNodeIds(x.value, [x.key]),
    )
    const nodeDetails = nodesIdPaths
        .map((x) => ({
            ...x,
            nodeObj: nodesIndex.get(x.nodeId),
        }))
        .map((x) => ({
            ...x,
            name: x.nodeObj?.$schema.nameInCushy,
            pathStr: x.path.join(`.`),
        }))
    const requiredNodeIds = new Set(nodesIdPaths.map((x) => x.nodeId))

    const disabledNodes = [...nodesIndex.values()]
        .map((x) => ({
            nodeId: x.uid,
            nodeObj: x,
        }))
        .map((x) => ({
            ...x,
            name: x.nodeObj?.$schema.nameInCushy,
        }))
        .filter((x) => !requiredNodeIds.has(x.nodeId))

    console.log(`disableUnusedGraph: nodeDetails`, { allScopeValues, nodeDetails, disabledNodes })
    state.runtime.workflow.nodes.filter((x) => !requiredNodeIds.has(x.uid)).forEach((n) => n.disable())
}
