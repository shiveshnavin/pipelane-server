import axios from "axios";
import PipeLane, { PipeTask } from "pipelane";

export class ApiTask extends PipeTask<any, any> {

    static TASK_VARIANT_NAME: string = "api"
    static TASK_TYPE_NAME: string = "api"

    constructor(variantName?: string) {
        super(ApiTask.TASK_TYPE_NAME, variantName || ApiTask.TASK_VARIANT_NAME)
    }

    kill(): boolean {
        return true
    }
    async execute(pipeWorkInstance: PipeLane, input: any): Promise<any[]> {
        input = input.additionalInputs
        if (!input.url) {
            return [{
                status: false,
                message: 'invalid input'
            }]
        }
        let options = input
        try {
            let response = await axios.get(input.url, options)
            if (response) {
                return [{
                    status: response.status < 300,
                    statusCode: response.status,
                    ...response?.data
                }]
            }
        } catch (e) { }
        return [{
            status: false
        }]
    }

}