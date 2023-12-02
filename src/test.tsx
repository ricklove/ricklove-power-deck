import React, { useState } from 'react'
import { renderToString } from 'react-dom/server'

export type TestComponentViewState = InteractiveViewState & {
    items?: string[]
}
export const TestComponentWrapper = ({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) => {
    return <TestComponent value={(value as TestComponentViewState) ?? {}} onChange={onChange} />
}
const TestComponent = (props: { value: TestComponentViewState; onChange: (value: TestComponentViewState) => void }) => {
    const { value } = props
    const change = (v: Partial<TestComponentViewState>) => {
        props.onChange({ ...props.value, ...v })
    }

    return (
        <div>
            <div>test component</div>
            <InteractiveTest {...props} onChange={change} />
            <div>
                <div>This is a react component:</div>
                <div className='flex-row flex-wrap'>
                    <div className='w-12 hover:scale-150'>
                        <img src='D:/Projects/ai/CushyStudio/outputs/base_00001_.png' />
                    </div>
                </div>

                {value.items?.map((x) => (
                    <React.Fragment key={x}>
                        <div>{x}</div>
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
