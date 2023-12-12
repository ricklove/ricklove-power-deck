import { ComfyNodeOutput } from 'src/core/Slot'
import { AppState, StopError, disableNodesAfterInclusive, getNextActiveNodeIndex, getEnabledNodeNames } from './_appState'
import { cacheImage, cacheImageBuilder, cacheMaskBuilder } from './_cache'
import { Widget } from 'src'
import { ComfyNode } from 'src/core/ComfyNode'
import { showLoadingMessage } from './_loadingMessage'

type StepState = AppState

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never
// type MergeNestedFields<T extends Record<string, unknown>> = UnionToIntersection<T[keyof T]>
// type MergeFieldsTest = MergeFields<
//     {
//         aObj: { a: boolean }
//     } & {
//         bObj: { b: boolean }
//     }
// >
// const { a, b } = null as unknown as MergeFieldsTest

type OutputsOfInputSteps<TInputStepDefinitions extends Record<string, undefined | {} | { $Outputs: Record<string, unknown> }>> =
    UnionToIntersection<
        {
            [K in keyof TInputStepDefinitions]: TInputStepDefinitions[K] extends { $Outputs: Record<string, unknown> }
                ? TInputStepDefinitions[K][`$Outputs`]
                : TInputStepDefinitions[K] extends undefined | { $Outputs: Record<string, unknown> }
                ? Partial<NonNullable<TInputStepDefinitions[K]>[`$Outputs`]>
                : never
        }[keyof TInputStepDefinitions]
    >
// const { a, b } = null as unknown as OutputsOfInputSteps<{
//     aObj: { outputs: { a: boolean } }
//     bObj: { outputs: { b: boolean } }
//     cObj: {}
// }>

// type StepOutputType = undefined | ComfyNodeOutput<unknown> | Record<string, ComfyNodeOutput<unknown>> | (() => ComfyNodeOutput<unknown>)
type StepOutputType = undefined | ComfyNodeOutput<unknown> | _IMAGE | _MASK
export type StepDefinition<
    TNodes extends Record<string, unknown> = Record<string, unknown>,
    TInputStepDefinitions extends Record<
        string,
        undefined | {} | { $Outputs: Record<string, StepOutputType>; _build?: { outputs: TStepOutputs } }
    > = Record<string, { $Outputs: Record<string, StepOutputType>; _build?: { outputs: Record<string, StepOutputType> } }>,
    TStepOutputs extends Record<string, StepOutputType> = Record<string, StepOutputType>,
> = {
    name: string
    inputSteps: TInputStepDefinitions
    cacheParams: Widget[`$Output`] | Record<string, unknown>
    create: (
        state: StepState,
        args: { inputs: OutputsOfInputSteps<TInputStepDefinitions> },
    ) => {
        nodes: TNodes
        outputs: TStepOutputs
    }
    modify: (args: { nodes: TNodes; frameIndex: number }) => void
    preview?: boolean
    $Outputs: TStepOutputs
    _build?: StepBuild<TNodes, TStepOutputs>
}
type StepBuild<
    TNodes extends Record<string, unknown> = Record<string, unknown>,
    TStepOutputs extends Record<string, StepOutputType> = Record<string, StepOutputType>,
> = {
    setFrameIndex: (frameIndex: number) => void
    outputs: TStepOutputs
    _nodes: TNodes
}

export const createStepsSystem = (appState: Omit<AppState, `workingDirectory`>) => {
    const _state = appState as AppState
    _state.workingDirectory = `${_state.imageDirectory}/working`
    const stepsRegistry = [] as StepDefinition[]

    const defineStep = <
        TNodes extends Record<string, unknown>,
        TInputStepDefinitions extends Record<string, undefined | {} | { $Outputs: Record<string, StepOutputType> }>,
        TStepOutputs extends Record<string, StepOutputType>,
    >({
        name,
        inputSteps,
        create,
        modify,
        preview = false,
        cacheParams,
    }: {
        name: string
        inputSteps: TInputStepDefinitions
        create: (
            state: StepState,
            args: { inputs: OutputsOfInputSteps<TInputStepDefinitions> },
        ) => {
            nodes: TNodes
            outputs: TStepOutputs
        }
        modify: (args: { nodes: TNodes; frameIndex: number }) => void
        preview?: boolean
        cacheParams: (Widget[`$Output`] | Record<string, unknown>)[]
    }): StepDefinition<TNodes, TInputStepDefinitions, TStepOutputs> => {
        const stepDefinition: StepDefinition<TNodes, TInputStepDefinitions, TStepOutputs> = {
            name,
            inputSteps,
            create,
            modify,
            preview,
            cacheParams,
            $Outputs: undefined as unknown as TStepOutputs,
        }
        stepsRegistry.push(stepDefinition as unknown as StepDefinition)
        return stepDefinition
    }

    const buildStep = (stepDef: StepDefinition) => {
        console.log(`buildStep:`, stepDef)
        const { inputSteps, create, modify, preview } = stepDef

        const inputs = Object.fromEntries(
            Object.values(inputSteps).flatMap((x) => Object.entries(x?._build?.outputs ?? {})),
        ) as Record<string, StepOutputType>
        console.log(`buildStep: inputs`, { inputs })

        const { nodes, outputs } = create(_state, { inputs })
        console.log(`buildStep: outputs`, { outputs })

        // const outputsList = Object.values(outputs)
        // const getOutputNodeType = (x: StepOutputType): undefined | string => {
        //     if (typeof x === `function`) {
        //         return undefined
        //     }
        //     if (typeof x !== `object`) {
        //         return undefined
        //     }

        //     if (`type` in x) {
        //         return x.type as string
        //     }

        //     return undefined
        // }
        // const isCacheable = (x: StepOutputType) => {
        //     const t = getOutputNodeType(x)?.toLowerCase()
        //     return t === `image` || t === `mask`
        // }
        // const cachableOutputs = outputsList.filter((x) => isCacheable(x))
        // const canBeCached = outputsList.length === cachableOutputs.length

        // return (frameIndex: number) => run(nodes, frameIndex)
        // const outputs = {}
        const stepBuildDefinition = {
            setFrameIndex: (frameIndex: number) => modify({ nodes, frameIndex }),
            outputs,
            // canBeCached,
            _nodes: nodes,
        }

        stepDef._build = stepBuildDefinition
        console.log(`buildStep: stepBuildDefinition`, {
            stepBuildDefinition,
            // canBeCached, cachableOutputs,
            stepDef,
        })

        return stepBuildDefinition
    }

    // const runStepsInner = async (stepsAll: StepDefinition[], frameIndexes: number[]) => {
    //     // Group by cacheable
    //     const runGroups = [{ steps: [] as StepDefinition[] }]
    //     stepsAll.forEach((x) => {
    //         runGroups[runGroups.length - 1].steps.push(x)
    //         if (x._build?.canBeCached) {
    //             runGroups.push({ steps: [] })
    //         }
    //     })

    //     for (const g of runGroups) {
    //         const steps = g.steps
    //         for (const frameIndex of frameIndexes) {
    //             console.log(`runSteps: running ${frameIndex}`, { frameIndexes, steps })
    //             stepsAll.forEach((s) => s._build?.setFrameIndex(frameIndex))
    //             await _state.runtime.PROMPT()
    //             await new Promise((r) => setTimeout(r, 1000))
    //         }
    //     }
    // }

    // const runSteps = async (frameIndexes: number[]) => {
    //     // loop (each line for all frames):
    //     // - build a step
    //     // - create cache for each output possible
    //     // - run the caching prompt to create cache
    //     // - replace the output with the cached version

    //     // // build steps
    //     // try {
    //     //     for (const s of stepsRegistry) {
    //     //         buildStep(s)
    //     //     }
    //     // } catch (err) {
    //     //     if (!(err instanceof StopError)) {
    //     //         throw err
    //     //     }

    //     //     // end definition early
    //     //     if (err.setFrameIndex) {
    //     //         const firstUnbuilt = stepsRegistry.find((x) => !x._build)
    //     //         if (firstUnbuilt) {
    //     //             firstUnbuilt._build = { setFrameIndex: err.setFrameIndex, _nodes: {}, outputs: {}, canBeCached: false }
    //     //         }
    //     //     }
    //     // }

    //     // await runStepsInner(stepsRegistry, frameIndexes)
    // }

    const runSteps = async (frameIndexes: number[]) => {
        // loop (each line for all frames):
        // - build a step
        // - create cache for each output possible
        // - run the caching prompt to create cache
        // - replace the output with the cached version

        const dependencyKeyRef = { dependencyKey: `` }

        const changeFrame = (frameIndex: number) => {
            stepsRegistry.forEach((s) => s._build?.setFrameIndex(frameIndex))
        }

        try {
            for (const stepDef of stepsRegistry) {
                // build a step
                console.log(`runSteps: buildStep START`, {
                    stepName: stepDef.name,
                    stepDef,
                    ...getEnabledNodeNames(_state.runtime),
                })
                const iStepStart = getNextActiveNodeIndex(_state.runtime)
                const stepBuild = buildStep(stepDef)

                // create cache for each output possible
                console.log(`runSteps: check for cachable outputs`, { stepName: stepDef.name, stepDef })
                const cachedOutputs = [] as { loadCacheAsOutput: () => void }[]
                for (const kOutput in stepBuild.outputs) {
                    const vOutput = stepBuild.outputs[kOutput]

                    const getCacheBuilderResult = () => {
                        if (typeof vOutput !== `object`) {
                            return
                        }

                        const vOutputTyped = vOutput as Partial<ComfyNodeOutput<{}>>
                        const vOutputSchemaType = vOutputTyped.node?.$schema.outputs[vOutputTyped.slotIx ?? 0].typeName

                        const vOutputType = vOutputSchemaType?.toLowerCase()
                        if (vOutputType === `image`) {
                            return cacheImageBuilder(_state, kOutput, stepDef.cacheParams, dependencyKeyRef)
                        }

                        if (vOutputType === `mask`) {
                            return cacheMaskBuilder(_state, kOutput, stepDef.cacheParams, dependencyKeyRef)
                        }

                        return undefined
                    }

                    const cacheBuilderResult = getCacheBuilderResult()
                    if (!cacheBuilderResult) {
                        console.log(`runSteps: step SKIPPED - no cacheBuilderResult`, {
                            stepName: stepDef.name,
                            kOutput,
                            stepDef,
                            vOutput,
                        })
                        continue
                    }

                    // check for missing frames
                    console.log(`runSteps: check for uncached frames`, {
                        stepName: stepDef.name,
                        kOutput,
                        stepDef,
                    })
                    const missingFrameIndexes = [] as number[]
                    for (const frameIndex of frameIndexes) {
                        if (!(await cacheBuilderResult.exists(frameIndex))) {
                            missingFrameIndexes.push(frameIndex)
                        }
                    }

                    // create missing frames
                    if (missingFrameIndexes.length) {
                        console.log(`runSteps: createCache START: create missing cache frames`, {
                            stepName: stepDef.name,
                            kOutput,
                            stepDef,
                            missingFrameIndexes,
                            ...getEnabledNodeNames(_state.runtime),
                        })
                        // remove load
                        // disableNodesAfterInclusive(_state.runtime, iLoadCache)

                        // create cache
                        const iCache = getNextActiveNodeIndex(_state.runtime)
                        const cacheResult = cacheBuilderResult.createCache(() => vOutput as IMAGE & MASK)
                        if (!cacheResult) {
                            disableNodesAfterInclusive(_state.runtime, iCache)
                            console.log(`runSteps: cacheResult is MISSING - cannot cache`, {
                                stepName: stepDef.name,
                                kOutput,
                                stepDef,
                                missingFrameIndexes,
                                ...getEnabledNodeNames(_state.runtime),
                            })
                            continue
                        }

                        const { getOutput: getCachedOutput, modify: modifyCacheLoader } = cacheResult
                        const loadingMessage = showLoadingMessage(_state.runtime, `Generating cache`, {
                            stepName: stepDef.name,
                            kOutput,
                            frameIndexes,
                        })
                        await new Promise((r) => setTimeout(r, 10))

                        for (const frameIndex of frameIndexes) {
                            changeFrame(frameIndex)
                            modifyCacheLoader(frameIndex)
                            await _state.runtime.PROMPT()
                            await new Promise((r) => setTimeout(r, 10))
                        }

                        // remove create cache
                        disableNodesAfterInclusive(_state.runtime, iCache)

                        console.log(`runSteps: createCache END`, {
                            stepName: stepDef.name,
                            kOutput,
                            stepDef,
                            missingFrameIndexes,
                            ...getEnabledNodeNames(_state.runtime),
                        })

                        await new Promise((r) => setTimeout(r, 10))
                        loadingMessage.delete()
                    }

                    // replace output with cached output
                    console.log(
                        `runSteps: loadCached - replace output with cached output ${
                            missingFrameIndexes.length ? `` : `NO Missing Frames to cache`
                        }`,
                        {
                            stepName: stepDef.name,
                            kOutput,
                            stepDef,
                            missingFrameIndexes,
                        },
                    )

                    const { getOutput: getCachedOutput, modify: modifyCacheLoader } = cacheBuilderResult.loadCached()
                    stepBuild.outputs[kOutput] = getCachedOutput()
                    stepBuild.setFrameIndex = modifyCacheLoader

                    cachedOutputs.push({
                        loadCacheAsOutput: () => {
                            const loader = cacheBuilderResult.loadCached()
                            stepBuild.outputs[kOutput] = loader.getOutput()
                            stepBuild.setFrameIndex = loader.modify
                        },
                    })
                }

                // done if something not cached
                if (cachedOutputs.length !== Object.keys(stepBuild.outputs).length) {
                    console.log(`runSteps: NOT FULLY CACHED`, {
                        stepName: stepDef.name,
                        stepDef,
                        ...getEnabledNodeNames(_state.runtime),
                    })

                    // preview
                    if (stepDef.preview) {
                        _state.graph.PreviewImage({ images: _state.runtime.AUTO })
                        throw new StopError(undefined)
                    }
                    continue
                }

                console.log(`runSteps: remove non-cache nodes and add load cache`, {
                    stepName: stepDef.name,
                    stepDef,
                    ...getEnabledNodeNames(_state.runtime),
                })

                // remove whole step if every output is cached
                disableNodesAfterInclusive(_state.runtime, iStepStart)

                // enable cache output nodes
                cachedOutputs.forEach((x) => x.loadCacheAsOutput())

                console.log(`runSteps: step CACHED`, {
                    stepName: stepDef.name,
                    stepDef,
                    ...getEnabledNodeNames(_state.runtime),
                })

                // preview
                if (stepDef.preview) {
                    _state.graph.PreviewImage({ images: _state.runtime.AUTO })
                    throw new StopError(undefined)
                }
            }
        } catch (err) {
            if (!(err instanceof StopError)) {
                throw err
            }

            console.log(`runSteps: Stop Preview - Running up to this point in the graph for all frames`, {
                ...getEnabledNodeNames(_state.runtime),
            })

            for (const frameIndex of frameIndexes) {
                changeFrame(frameIndex)
                if (err.setFrameIndex) {
                    err.setFrameIndex(frameIndex)
                }

                await _state.runtime.PROMPT()
            }
        }

        return dependencyKeyRef
    }

    return {
        state: _state,
        defineStep,
        runSteps,
    }
}
