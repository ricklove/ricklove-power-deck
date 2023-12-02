import React, { useState } from 'react'
import { renderToString } from 'react-dom/server'
import { Widget_CustomComponentProps } from 'src'

export type OptimizerComponentViewState = InteractiveViewState & {
    images?: { imageId: string; value: unknown }[]
}
export const OptimizerComponent = (props: Widget_CustomComponentProps) => {
    return <OptimizerComponentInner {...(props as Widget_CustomComponentProps<OptimizerComponentViewState>)} />
}

const OptimizerComponentInner = (props: Widget_CustomComponentProps<OptimizerComponentViewState>) => {
    const { value = {} } = props
    const change = (v: Partial<OptimizerComponentViewState>) => {
        props.onChange({ ...props.value, ...v })
    }

    const imagesSorted = (value.images ?? [])?.sort((a, b) => {
        if (typeof a.value === `number` && typeof b.value === `number`) {
            return a.value - b.value
        }

        return `${a.value}`.localeCompare(`${b.value}`)
    })

    return (
        <div>
            <div className='flex flex-row flex-wrap'>
                {imagesSorted.map((x, i) => (
                    <React.Fragment key={i}>
                        <div className='flex flex-col'>
                            <div>{`${
                                typeof x.value === `number` && !Number.isInteger(x.value)
                                    ? (x.value as number).toFixed?.(2)
                                    : x.value
                            }`}</div>
                            <div>{x.imageId && <props.ui.image imageId={x.imageId} />}</div>
                        </div>
                    </React.Fragment>
                ))}
            </div>
        </div>
    )
}

type InteractiveViewState = {
    clickCount?: number
}
const InteractiveTest = (props: { value: InteractiveViewState; onChange: (value: Partial<InteractiveViewState>) => void }) => {
    const {
        value: { clickCount = 0 },
        onChange,
    } = props

    return (
        <>
            <div>Interactive Component</div>
            <div onClick={() => onChange({ clickCount: clickCount + 1 })}>value: {clickCount}</div>
            <div>Interactive Component END</div>
        </>
    )
}

// export const testHtmlContent = renderToString(<TestComponent />)
