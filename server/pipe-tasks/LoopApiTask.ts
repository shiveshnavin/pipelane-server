import axios from "axios";
//@ts-ignore
import PipeLane, { PipeTask } from "pipelane";
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


    async execute(pipeWorkInstance: PipeLane, inputs: any): Promise<any[]> {
        const last = inputs.last;
        const outputs = [];
        const limiter = new RateLimiter({
            tokensPerInterval: inputs.additionalInputs?.rate || 10,
            interval: 'second'
        });

        // Function to handle each request with rate limiting
        const handleRequest = async (options) => {
            await limiter.removeTokens(1);
            try {
                let response = await axios(options);
                return {
                    status: response.status < 300,
                    statusCode: response.status,
                    headers: response.headers,
                    data: response?.data
                };
            } catch (e) {
                pipeWorkInstance.onLog(e.message);
                return {
                    status: false,
                    message: e.message,
                    statusCode: e.response?.status,
                    headers: e?.response.headers,
                    data: e.response?.data
                };
            }
        };

        // Create a queue to manage parallel requests
        const promises = last.map(options => handleRequest(options));

        // Execute requests in parallel with rate limiting
        const results = await Promise.all(promises);
        outputs.push(...results);

        return outputs;
    }

}