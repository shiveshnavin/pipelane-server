import axios from "axios";
import PipeLane, { InputWithPreviousInputs, OutputWithStatus, PipeTask } from "pipelane";

export type EvaluateJsTaskInput = InputWithPreviousInputs & {
    last: OutputWithStatus[],
    additionalInputs: {
        js: string
    }
}
export class EvaluateJsTask extends PipeTask<EvaluateJsTaskInput, any> {

    static TASK_VARIANT_NAME: string = "eval-js"
    static TASK_TYPE_NAME: string = "eval-js"
    timeoutId: any

    constructor(variantName?: string) {
        super(EvaluateJsTask.TASK_TYPE_NAME, variantName || EvaluateJsTask.TASK_VARIANT_NAME)
    }

    kill(): boolean {
        return true
    }

    async evalInScope(js, pl, input, prev, axios) {
        return await eval(js)
    }

    /**
     * 
     * @param pipeWorkInstance 
     * @param input { additionalInputs: {js} }, No need to enclose js in this input with ${} as it is           understood that the value of field js is a javascript string
     * @returns 
     */
    async execute(pipeWorkInstance: PipeLane, input: EvaluateJsTaskInput): Promise<any[]> {
        if (!input.additionalInputs.js) {
            return [{
                status: false,
                message: 'invalid input. required field `js` in additionalInputs  missing'
            }]
        }

        let js = input.additionalInputs.js
        let prev = input.last
        try {
            let output = await this.evalInScope(js, pipeWorkInstance, input, prev, axios)
            return [{
                status: true,
                output: output
            }]
        } catch (e) {
            return [{
                status: false,
                error: e.message
            }]
        }
    }


    async evaluatePlaceholdersInString(
        pl: PipeLane,
        input: InputWithPreviousInputs,
        jsInputString: string): Promise<string | undefined> {
        const placeholderRegex = /\${([^}]+)}/g;
        let prev = input.last
        //@ts-ignore
        let replacedString = jsInputString;
        const matches = jsInputString.matchAll(placeholderRegex);
        for (const match of matches) {
            const [fullMatch, placeholder] = match;
            const result = await this.evalInScope(placeholder.trim(), pl, input, prev, axios);
            replacedString = replacedString.replace(fullMatch, result?.toString());
        }

        return replacedString
    }
}


const cut = new EvaluateJsTask()
function test() {
    cut.execute(new PipeLane({}), {
        additionalInputs: {
            js: "${task.taskTypeName}"
        },
        last: []
    })
}

// test()