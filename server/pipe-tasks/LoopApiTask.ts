import axios from "axios";
//@ts-ignore
import PipeLane, { PipeTask, PipeTaskDescription } from "pipelane";
import { RateLimiter } from "limiter";

export class LoopApiTask extends PipeTask<any, any> {

    static TASK_VARIANT_NAME: string = "loop-api"
    static TASK_TYPE_NAME: string = "api"

    constructor(variantName?: string) {
        super(LoopApiTask.TASK_TYPE_NAME, variantName || LoopApiTask.TASK_VARIANT_NAME)
    }

    kill(): boolean {
        return true
    }

    describe(): PipeTaskDescription | undefined {
        return {
            summary: "Call APIs in parallel with rate limiting",
            inputs: {
                additionalInputs: {
                    retry: 0,
                    sequential: "boolean, if true, other rate fields will be ignored",
                    rate: "Number, x requests / Y interval",
                    interval: "day | hour | min | sec"
                },
                last: [{
                    url: "string, the url of the API",
                    method: "string, Http method",
                    headers: "object, an object of headers"
                }]
            }
        }
    }

    async execute(pipeWorksInstance: PipeLane, inputs: any): Promise<any[]> {
        const last = inputs.last;
        const outputs = [];
        const limiter = new RateLimiter({
            tokensPerInterval: inputs.additionalInputs?.rate || 10,
            interval: inputs.additionalInputs?.interval || 'second'
        });

        // Function to handle each request with rate limiting
        const handleRequest = async (options) => {
            if (!inputs.additionalInputs.sequential)
                await limiter.removeTokens(1);

            let retryRemaining = inputs.additionalInputs?.retry || 0;
            let err = undefined
            do {
                try {
                    let response = await axios(options);
                    return {
                        status: response.status < 300,
                        statusCode: response.status,
                        headers: response.headers,
                        data: response?.data
                    };
                } catch (e) {
                    pipeWorksInstance.onLog(e.message)
                    err = {
                        status: false,
                        message: e.message,
                        statusCode: e.response?.status,
                        headers: e?.response?.headers,
                        data: e.response?.data
                    }
                }
            } while (--retryRemaining > 0);
            return err;
        };

        // Create a queue to manage parallel requests
        if (!inputs.additionalInputs.sequential) {
            const promises = last.map(options => handleRequest(options));
            const results = await Promise.all(promises);
            outputs.push(...results);
        } else {
            for (let options of last) {
                let response = await handleRequest(options).catch(e => ({
                    status: false,
                    message: `Request failed. ${e.message} ${e.response?.status} ${JSON.stringify(e.response?.data)}`
                }))
                outputs.push(response)
            }
        }

        return outputs;
    }

}