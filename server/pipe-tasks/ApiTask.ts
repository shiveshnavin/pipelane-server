import axios, { AxiosRequestConfig } from "axios";
import jsonpath from "jsonpath";
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
                    retry: 0,
                    url: "string, the url of the API",
                    method: "string, Http method",
                    headers: "object, an object of headers",
                    jsonPath: "string, optional, $ = response (e.g. $.headers will return headers) if provided, the output of the API call data will be extracted with this json path"
                }
            }
        }
    }

    async execute(pipeWorksInstance: PipeLane, input: any): Promise<any[]> {
        input = input.additionalInputs
        let retryRemaining = input.retry || 0;
        if (!input.url) {
            return [{
                status: false,
                message: 'invalid input'
            }]
        }
        let options = input
        let err = []
        do {
            try {

                let response = await axios(options)
                if (response) {
                    let data = response?.data
                    if (input.jsonPath) {
                        try {
                            const extracted = jsonpath.value(response, input.jsonPath)
                            if (extracted !== undefined) {
                                data = extracted

                                if (Array.isArray(data) && data.every(d => typeof d === 'string')) {
                                    return data.map(d => ({
                                        status: response.status < 300,
                                        data: d
                                    }))
                                }
                                else if (Array.isArray(data) && data.every(d => typeof d === 'object')) {
                                    return data.map(d => ({
                                        status: response.status < 300,
                                        ...d
                                    }))
                                }
                                else if (typeof data === 'object') {
                                    return [{
                                        status: response.status < 300,
                                        ...data
                                    }]
                                }
                                else {
                                    return [{
                                        status: response.status < 300,
                                        data
                                    }]
                                }
                            }
                        } catch (jsonErr) {
                            pipeWorksInstance.onLog(`jsonPath extraction failed: ${jsonErr.message}`)
                        }
                    }
                    return [{
                        status: response.status < 300,
                        statusCode: response.status,
                        headers: response.headers,
                        data
                    }]
                }
            } catch (e) {
                pipeWorksInstance.onLog(e.message)
                err = [{
                    status: false,
                    message: e.message,
                    statusCode: e.response?.status,
                    headers: e?.response?.headers,
                    data: e.response?.data
                }]
            }
        } while (--retryRemaining > 0);
        return err;
    }

}