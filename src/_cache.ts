import { AppState, disableNodesAfter, getNextActiveNodeIndex } from './_appState'
import { loadingMessages } from './humor/_loading'
import { createRandomGenerator } from './_random'
import { Runtime } from 'src'

const rand = createRandomGenerator(`${Date.now()}`)
const randomLoadingMessage = (
    runtime: Runtime,
    context: string,
    contextData?: Record<string, string | number | boolean | undefined | null>,
) => {
    return runtime.output_Markdown(`### Loading... 
    
${context}

${
    !contextData
        ? ``
        : Object.entries(contextData)
              .map(([k, v]) =>
                  typeof v === `string` && v.includes(`\n`) ? `- ${k}: \n\n    ${v.split(`\n`).join(`\n    `)}` : `- ${k}: ${v}`,
              )
              .join(`\n`)
}
    
- ${rand.randomItem(loadingMessages)}
- ${rand.randomItem(loadingMessages)}
- ${rand.randomItem(loadingMessages)}
- ${rand.randomItem(loadingMessages)}
- ${rand.randomItem(loadingMessages)}

`)
}

export const cacheMask = async <TMASK extends undefined | _MASK | MASK>(
    state: AppState,
    frameIndex: number,
    paramsKey: string,
    createMaskGraph: () => Promise<TMASK>,
): Promise<TMASK> => {
    const { runtime, graph } = state
    const paramsPath = createRandomGenerator(paramsKey).randomInt()
    const paramsFilePattern = `${state.workingDirectory}/${paramsPath}/#####.png`

    const loadMaskGraph = () => {
        const maskImageReloaded = graph.RL$_LoadImageSequence({
            path: paramsFilePattern,
            current_frame: frameIndex,
        }).outputs.image
        const maskReloaded = graph.Image_To_Mask({
            image: maskImageReloaded,
            method: `intensity`,
        }).outputs.MASK
        return maskReloaded as TMASK
    }

    const createMask = async () => {
        const mask = await createMaskGraph()
        if (!mask) {
            return undefined as TMASK
        }

        const maskImage = graph.MaskToImage({ mask })
        graph.RL$_SaveImageSequence({
            images: maskImage,
            current_frame: frameIndex,
            path: paramsFilePattern,
        })
        // graph.PreviewImage({ images: maskImage })
        const result = await runtime.PROMPT()
        if (result.data.error) {
            throw new Error(`cacheMask: Failed to create mask`)
        }
    }

    const iNextInitial = getNextActiveNodeIndex(runtime)
    const loadingMessage = randomLoadingMessage(runtime, `cacheMask ${frameIndex}`, { frameIndex, paramsKey })

    try {
        const mask = loadMaskGraph()
        const result = await runtime.PROMPT()
        if (result.data.error) {
            result.delete()

            throw new Error(`ignore`)
        }

        loadingMessage.delete()
        console.log(
            `cacheMask: Load Success`,
            JSON.parse(
                JSON.stringify({
                    data: result.data,
                    finished: result.finished,
                }),
            ),
        )

        return mask
    } catch {
        disableNodesAfter(runtime, iNextInitial)
    }

    console.log(`cacheMask: Failed to load - creating`, {
        paramsFilePattern,
        frameIndex,
        paramsKey,
    })
    await createMask()
    disableNodesAfter(runtime, iNextInitial)
    loadingMessage.delete()

    return loadMaskGraph()
}
