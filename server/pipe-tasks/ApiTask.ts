import axios, { AxiosRequestConfig } from "axios";
//@ts-ignore
import PipeLane, { PipeTask, PipeTaskDescription } from "pipelane";

export class ApiTask extends PipeTask<any, any> {

    static TASK_VARIANT_NAME: string = "api"
    static TASK_TYPE_NAME: string = "api"

    constructor(variantName?: string) {
        super(ApiTask.TASK_TYPE_NAME, variantName || ApiTask.TASK_VARIANT_NAME)
    }

    kill(): boolean {
        return true
    }

    describe(): PipeTaskDescription | undefined {
        return {
            summary: "Call an API",
            inputs: {
                last: [],
                additionalInputs: {
                    url: "string, the url of the API",
                    method: "string, Http method",
                    headers: "object, an object of headers"
                }
            }
        }
    }

    async execute(pipeWorksInstance: PipeLane, input: any): Promise<any[]> {
        input = input.additionalInputs
        if (!input.url) {
            return [{
                status: false,
                message: 'invalid input'
            }]
        }
        let options = input
        try {
            let response = await axios(options)
            if (response) {
                return [{
                    status: response.status < 300,
                    statusCode: response.status,
                    headers: response.headers,
                    data: response?.data
                }]
            }
        } catch (e) {
            pipeWorksInstance.onLog(e.message)
            return [{
                status: false,
                message: e.message,
                statusCode: e.response?.status,
                headers: e?.response?.headers,
                data: e.response?.data
            }]
        }

    }

}