import { loadFromScope, storeInScope } from '../_appState'
import { createFrameOperation, createFrameOperationsGroupList } from './_frame'

const output3d = createFrameOperation({
    options: {
        hideLoadVariables: true,
    },
    ui: (form) => ({
        // frameIndex: form.int({ default: 0 }),
        imageVariable: form.string({ default: `a` }),
        depthImageVariable: form.string({ default: `a` }),
        normalImageVariable: form.string({ default: `a` }),

        // imageFilePrefix: form.string({ default: `a` }),
        // depthFilePrefix: form.string({ default: `a` }),
        // normalFilePrefix: form.string({ default: `a` }),
    }),
    run: (state, form, { image, afterFramePrompt }) => {
        const { graph } = state

        const saveImage = (imageVariable: string, saveName: string) => {
            const resizedImage = graph.ImageTransformResizeRelative({
                images: loadFromScope(state, imageVariable) ?? image,
                method: `lanczos`,
                scale_width: 1,
                scale_height: 1,
            }).outputs.IMAGE
            graph.SaveImage({ images: resizedImage, filename_prefix: saveName })
            graph.PreviewImage({ images: resizedImage })
            return resizedImage
        }

        saveImage(form.imageVariable, `image`)
        saveImage(form.depthImageVariable, `depth`)
        saveImage(form.normalImageVariable, `normal`)

        afterFramePrompt.push(() => {
            state.runtime.output_3dImage({
                image: `image`,
                depth: `depth`,
                normal: `normal`,
            })
        })

        // state.runtime.output_3dImage({
        //     image: form.imageFilePrefix,
        //     depth: form.depthFilePrefix,
        //     normal: form.normalFilePrefix,
        // })

        // this.st.db.media_3d_displacement.create({
        //     // type: 'displaced-image',
        //     width: image.data.width ?? 512,
        //     height: image.data.height ?? 512,
        //     image: image.url,
        //     depthMap: depth.url,
        //     normalMap: normal.url,
        //     stepID: this.step.id,
        // })

        return { image }
    },
})

export const outputOperations = {
    output3d,
}
export const outputOperationsList = createFrameOperationsGroupList(outputOperations)
