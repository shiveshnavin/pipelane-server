import axios from "axios";
import PipeLane, { InputWithPreviousInputs, PipeTask, PipeTaskDescription } from "pipelane";

export class DelayTask extends PipeTask<any, any> {

    static TASK_VARIANT_NAME: string = "delay"
    static TASK_TYPE_NAME: string = "delay"
    timeoutId: any

    constructor(variantName?: string) {
        super(DelayTask.TASK_TYPE_NAME, variantName || DelayTask.TASK_VARIANT_NAME)
    }

    kill(): boolean {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId)
        }
        return true
    }

    describe(): PipeTaskDescription | undefined {
        return {
            summary: "Delays execution for the specified period",
            inputs: {
                additionalInputs: {
                    milis: "number, the period to wait for in milis"
                },
                last: []
            }
        }
    }
    async execute(pipeWorksInstance: PipeLane, input: InputWithPreviousInputs): Promise<any[]> {
        if (!input.additionalInputs.milis) {
            return [{
                status: false,
                message: 'invalid input. required feild `milis` missing'
            }]
        }

        return await new Promise((resolve) => {
            this.timeoutId = setTimeout(() => {
                if (!input.additionalInputs.last)
                    resolve([{
                        status: true
                    }])
                else
                    resolve(input.last)
            }, input.additionalInputs.milis)
        })

    }

}