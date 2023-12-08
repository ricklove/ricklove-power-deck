import { ComfyNodeOutput } from 'src/core/Slot'
import { AppState, StopError } from './_appState'

export const createStepsSystem = (appState: Omit<AppState, `workingDirectory`>) => {
    const _state = appState as AppState
    _state.workingDirectory = `${_state.imageDirectory}/working`
    type StepState = typeof _state

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

    type OutputsOfInputSteps<TInputStepDefinitions extends Record<string, {} | { $Outputs: Record<string, unknown> }>> =
        UnionToIntersection<
            {
                [K in keyof TInputStepDefinitions]: TInputStepDefinitions[K] extends { $Outputs: Record<string, unknown> }
                    ? TInputStepDefinitions[K][`$Outputs`]
                    : never
            }[keyof TInputStepDefinitions]
        >
    // const { a, b } = null as unknown as OutputsOfInputSteps<{
    //     aObj: { outputs: { a: boolean } }
    //     bObj: { outputs: { b: boolean } }
    //     cObj: {}
    // }>

    const stepsRegistry = [] as StepDefinition[]

    // type StepOutputType = undefined | ComfyNodeOutput<unknown> | Record<string, ComfyNodeOutput<unknown>> | (() => ComfyNodeOutput<unknown>)
    type StepOutputType = undefined | ComfyNodeOutput<unknown> | _IMAGE | _MASK
    type StepDefinition<
        TNodes extends Record<string, unknown> = Record<string, unknown>,
        TInputStepDefinitions extends Record<
            string,
            {} | { $Outputs: Record<string, StepOutputType>; _build?: { outputs: TStepOutputs } }
        > = Record<string, { $Outputs: Record<string, StepOutputType>; _build?: { outputs: Record<string, StepOutputType> } }>,
        TStepOutputs extends Record<string, StepOutputType> = Record<string, StepOutputType>,
    > = {
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
        $Outputs: TStepOutputs
        _build?: StepBuild<TNodes, TStepOutputs>
    }
    type StepBuild<
        TNodes extends Record<string, unknown> = Record<string, unknown>,
        TStepOutputs extends Record<string, StepOutputType> = Record<string, StepOutputType>,
    > = {
        setFrameIndex: (frameIndex: number) => void
        outputs: TStepOutputs
        canBeCached: boolean
        _nodes: TNodes
    }

    const defineStep = <
        TNodes extends Record<string, unknown>,
        TInputStepDefinitions extends Record<string, {} | { $Outputs: Record<string, StepOutputType> }>,
        TStepOutputs extends Record<string, StepOutputType>,
    >({
        inputSteps,
        create,
        modify,
        preview = false,
    }: {
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
    }): StepDefinition<TNodes, TInputStepDefinitions, TStepOutputs> => {
        const stepDefinition: StepDefinition<TNodes, TInputStepDefinitions, TStepOutputs> = {
            inputSteps,
            create,
            modify,
            preview,
            $Outputs: undefined as unknown as TStepOutputs,
        }
        stepsRegistry.push(stepDefinition as unknown as StepDefinition)
        return stepDefinition
    }

    const buildStep = (stepDef: StepDefinition) => {
        const { inputSteps, create, modify, preview } = stepDef
        const { nodes, outputs } = create(_state, {
            inputs: Object.fromEntries(
                Object.values(inputSteps).flatMap((x) => Object.entries(x._build?.outputs ?? {})),
            ) as Record<string, StepOutputType>,
        })

        const outputsList = Object.values(outputs)
        const getOutputNodeType = (x: StepOutputType): undefined | string => {
            if (typeof x === `function`) {
                return undefined
            }
            if (typeof x !== `object`) {
                return undefined
            }

            if (`type` in x) {
                return x.type as string
            }

            return undefined
        }
        const isCacheable = (x: StepOutputType) => {
            const t = getOutputNodeType(x)
            return t === `image` || t === `mask`
        }
        const cachableOutputs = outputsList.filter((x) => isCacheable(x))
        const canBeCached = outputsList.length === cachableOutputs.length

        // return (frameIndex: number) => run(nodes, frameIndex)
        // const outputs = {}
        const stepBuildDefinition = {
            setFrameIndex: (frameIndex: number) => modify({ nodes, frameIndex }),
            outputs,
            canBeCached,
            _nodes: nodes,
        }

        stepDef._build = stepBuildDefinition
        console.log(`defineStep: stepDefinition`, { stepBuildDefinition, canBeCached, cachableOutputs })

        if (preview) {
            _state.graph.PreviewImage({ images: _state.runtime.AUTO })
            throw new StopError(undefined)
        }

        return stepBuildDefinition
    }

    const runStepsInner = async (stepsAll: StepDefinition[], frameIndexes: number[]) => {
        // Group by cacheable
        const runGroups = [{ steps: [] as StepDefinition[] }]
        stepsAll.forEach((x) => {
            runGroups[runGroups.length - 1].steps.push(x)
            if (x._build?.canBeCached) {
                runGroups.push({ steps: [] })
            }
        })

        for (const g of runGroups) {
            const steps = g.steps
            for (const frameIndex of frameIndexes) {
                console.log(`runSteps: running ${frameIndex}`, { frameIndexes, steps })
                stepsAll.forEach((s) => s._build?.setFrameIndex(frameIndex))
                await _state.runtime.PROMPT()
                await new Promise((r) => setTimeout(r, 1000))
            }
        }
    }

    const runSteps = async (frameIndexes: number[]) => {
        // build steps
        try {
            for (const s of stepsRegistry) {
                buildStep(s)
            }
        } catch (err) {
            if (!(err instanceof StopError)) {
                throw err
            }

            // end definition early
            if (err.setFrameIndex) {
                const firstUnbuilt = stepsRegistry.find((x) => !x._build)
                if (firstUnbuilt) {
                    firstUnbuilt._build = { setFrameIndex: err.setFrameIndex, _nodes: {}, outputs: {}, canBeCached: false }
                }
            }
        }

        await runStepsInner(stepsRegistry, frameIndexes)
    }

    return {
        state: _state,
        defineStep,
        runSteps,
    }
}
