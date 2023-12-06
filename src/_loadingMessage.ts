import { Runtime } from 'src'
import { createRandomGenerator } from './_random'
import { loadingMessages } from './humor/_loading'

const rand = createRandomGenerator(`${Date.now()}`)
export const showLoadingMessage = (runtime: Runtime, title: string, data?: Record<string, unknown>): { delete: () => void } => {
    const message = `### Loading... 
    
    ${title}
    
    ${
        !data
            ? ``
            : Object.entries(data)
                  .map(([k, v]) =>
                      typeof v === `string` && v.includes(`\n`)
                          ? `- ${k}: \n\n    ${v.split(`\n`).join(`\n    `)}`
                          : `- ${k}: ${v}`,
                  )
                  .join(`\n`)
    }
    
    ### Detailed Master Plan
    
    ${[...new Array(20)].map((_) => `- ${rand.randomItem(loadingMessages)}`).join(`\n`)}
    
    ### Oops...
    
    - If you are reading this somehting probably broke
    - Manual intervention is likely required
    - Not sure why you are still reading
    - You should probably do something
    
    `

    let messageItem = runtime.output_Markdown(message)
    // Redisplay to take precendence over other messages
    const timeoutId = setTimeout(() => {
        messageItem.delete()
        messageItem = runtime.output_Markdown(message)
    }, 1000)

    return {
        delete: () => {
            clearTimeout(timeoutId)
            messageItem.delete()
        },
    }
}
