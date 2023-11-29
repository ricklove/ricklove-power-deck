card({
    ui: (form) => ({ name: form.str({}) }),
    run: (runtime) => runtime.print('Hello World')
})
