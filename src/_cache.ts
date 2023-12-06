import { AppState, disableNodesAfter, getNextActiveNodeIndex } from './_appState'
import { createRandomGenerator } from './_random'
import { showLoadingMessage } from './_loadingMessage'
import { Widget } from 'src'

type Params = Widget[`$Output`] | Record<string, unknown>
export const cacheImage = async <TIMAGE extends undefined | _IMAGE | IMAGE>(
    state: AppState,
    folderPrefix: string,
    frameIndex: number,
    params: Widget[`$Output`] | Record<string, unknown>,
    dependencyKeyRef: { dependencyKey: string },
    createGraph: () => Promise<TIMAGE>,
): Promise<{ image: TIMAGE }> => {
    const { runtime, graph } = state
    const paramsHash = `` + createRandomGenerator(`${JSON.stringify(params)}:${dependencyKeyRef.dependencyKey}`).randomInt()
    dependencyKeyRef.dependencyKey = paramsHash

    const paramsFilePattern = `${state.workingDirectory}/${folderPrefix}-${paramsHash}/#####.png`

    const loadImage_graph = () => {
        const imageReloaded = graph.RL$_LoadImageSequence({
            path: paramsFilePattern,
            current_frame: frameIndex,
        }).outputs.image
        return imageReloaded as TIMAGE
    }

    const createImage_execute = async () => {
        const image = await createGraph()
        if (!image) {
            return undefined as TIMAGE
        }

        graph.RL$_SaveImageSequence({
            images: image,
            current_frame: frameIndex,
            path: paramsFilePattern,
        })
        // graph.PreviewImage({ images: maskImage })
        const result = await runtime.PROMPT()
        if (result.data.error) {
            throw new Error(`cacheImage: Failed to create image`)
        }
    }

    const iNextInitial = getNextActiveNodeIndex(runtime)
    const loadingMessage = showLoadingMessage(runtime, `cacheImage( ${frameIndex} )`, { frameIndex, params })

    try {
        const image = loadImage_graph()
        const result = await runtime.PROMPT()
        if (result.data.error) {
            result.delete()

            throw new Error(`ignore`)
        }

        loadingMessage.delete()
        console.log(
            `cacheImage: Load Success`,
            JSON.parse(
                JSON.stringify({
                    data: result.data,
                    finished: result.finished,
                }),
            ),
        )

        return { image }
    } catch {
        disableNodesAfter(runtime, iNextInitial)
    }

    console.log(`cacheImage: Failed to load - creating`, {
        paramsFilePattern,
        frameIndex,
        params,
    })
    await createImage_execute()
    disableNodesAfter(runtime, iNextInitial)
    loadingMessage.delete()

    return { image: loadImage_graph() }
}

export const cacheMask = async <TMASK extends undefined | _MASK | MASK>(
    state: AppState,
    folderPrefix: string,
    frameIndex: number,
    params: Params,
    dependencyKeyRef: { dependencyKey: string },
    createGraph: () => Promise<TMASK>,
): Promise<{ mask: TMASK }> => {
    const { graph } = state

    const { image: reloadedMaskImage } = await cacheImage(state, folderPrefix, frameIndex, params, dependencyKeyRef, async () => {
        const mask = await createGraph()
        if (!mask) {
            return undefined
        }
        const maskImage = graph.MaskToImage({ mask })
        return maskImage
    })

    if (!reloadedMaskImage) {
        return { mask: undefined as TMASK }
    }

    const maskReloaded = graph.Image_To_Mask({
        image: reloadedMaskImage,
        method: `intensity`,
    }).outputs.MASK
    return { mask: maskReloaded as TMASK }
}
