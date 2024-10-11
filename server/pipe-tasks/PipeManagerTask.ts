import axios from "axios";
//@ts-ignore
import PipeLane, { PipeTask } from "pipelane";


/**
 * input : { 
 *      last:[{ pipeName , action: enable | disable }], 
 *      additionalInputs: { pipeName , action: enable | disable } 
 * }
 */
export class PipeManagerTask extends PipeTask<any, any> {

    static TASK_VARIANT_NAME: string = "manager"
    static TASK_TYPE_NAME: string = "pipe-manager"

    constructor(variantName?: string) {
        super(PipeManagerTask.TASK_TYPE_NAME, variantName || PipeManagerTask.TASK_VARIANT_NAME)
    }

    kill(): boolean {
        return true
    }

    async execute(pipeWorkInstance: PipeLane, input: any): Promise<any[]> {

        const pipeManagerInput: { pipeName: string, action: "enable" | "disable" }[] = []
        if (input.last && input.last.length > 0) {
            pipeManagerInput.push(...input.last)
        }
        if (input.additionalInputs?.pipeName) {
            pipeManagerInput.push(input.additionalInputs)
        }

        for (let pipe of pipeManagerInput) {
            if (pipe.pipeName) {
                if (!pipe.action) {
                    pipe.action = 'enable'
                }

            }
        }

        return pipeManagerInput

    }

}