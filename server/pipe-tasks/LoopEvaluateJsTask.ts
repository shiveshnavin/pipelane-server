import axios from "axios";
import PipeLane, { InputWithPreviousInputs, OutputWithStatus, PipeTask, PipeTaskDescription } from "pipelane";
import { EvaluateJsTask, EvaluateJsTaskInput } from "./EvaluateJsTask";

export class LoopEvaluateJsTask extends EvaluateJsTask {

    static TASK_VARIANT_NAME: string = "loop-eval-js"

    constructor(variantName?: string) {
        super(LoopEvaluateJsTask.TASK_VARIANT_NAME)
    }

    describe(): PipeTaskDescription | undefined {
        return {
            summary: "Process last output using JS. Must return in format [{status:true}]",
            inputs: {
                additionalInputs: {
                    js: "console.log(pl.inputs);\n//must return an array in output\n[{status:true, pl_inputs:pl.inputs}]"
                },
                last: [{
                    status: true
                }]
            }
        }
    }

    /**
     * 
     * @param pipeWorksInstance 
     * @param input { additionalInputs: {js} }, No need to enclose js in this input with ${} as it is           understood that the value of field js is a javascript string
     * @returns 
     */
    async execute(pipeWorksInstance: PipeLane, input: EvaluateJsTaskInput): Promise<any[]> {
        if (!input.additionalInputs.js) {
            return [{
                status: false,
                message: 'invalid input. required field `js` in additionalInputs  missing'
            }]
        }

        let js = input.additionalInputs.js
        let prev: any = input.last
        try {
            let output = await this.evalInScope(js, pipeWorksInstance, input, prev, axios)
            if (output == undefined || output.length == undefined) {
                return [{
                    status: false,
                    output,
                    message: 'The output must be an array in format [{status:true}]'
                }]
            }
            return output
        } catch (e) {
            return [{
                status: false,
                error: e.message,
                stack: JSON.stringify(e.stack || '').substring(0, 100)
            }]
        }
    }
}


const cut = new EvaluateJsTask()
function test() {
    cut.execute(new PipeLane({}, 'js'), {
        additionalInputs: {
            js: "${task.taskTypeName}"
        },
        last: []
    })
}

// test()