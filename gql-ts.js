const { existsSync, readdirSync, mkdirSync } = require('fs')
const path = require('path')

const generate = require('@graphql-codegen/cli').generate

async function doSomething(filePath) {
    if (!existsSync(filePath)) {
        console.warn(filePath, 'does not exists. skipping!')
        return
    }
    const name = path.basename(filePath).replace(".graphql", "")
    const baseDir = path.dirname(filePath)
    const opRel = path.join('gen', `${name}.ts`)
    const outputPath = path.join(baseDir, opRel)
    await generate(
        {
            schema: filePath,
            generates: {
                [outputPath]: {
                    plugins: ['typescript']
                }
            }
        },
        true
    )
    console.log('Generated', name, 'to', opRel)
}
let files = readdirSync(__dirname)
if (!existsSync(path.join(__dirname, 'gen'))) {
    mkdirSync(path.join(__dirname, 'gen'))
}
files.forEach(file => {
    if (file.indexOf(".graphql") > -1) {
        doSomething(path.join(__dirname, file))
    }
})