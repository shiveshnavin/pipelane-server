import axios from "axios";
import { method } from "lodash";
//@ts-ignore
import PipeLane, { PipeTask } from "pipelane";


export type PipeManagerInput = {
    pipeName: string,
    action: "enable" | "disable" | "delete" | "trigger",
    access_token: string,
    status: boolean
    trigger_inputs?: any
    endpoint: string
    message?: string
}

export class PipeManagerTask extends PipeTask<any, any> {

    static TASK_VARIANT_NAME: string = "manager"
    static TASK_TYPE_NAME: string = "pipe-manager"

    constructor(variantName?: string) {
        super(PipeManagerTask.TASK_TYPE_NAME, variantName || PipeManagerTask.TASK_VARIANT_NAME)
    }

    kill(): boolean {
        return true
    }


    getConfig(pipe: PipeManagerInput) {
        let req: any = {
            method: 'post',
            url: pipe.endpoint,
            headers: {
                'Authorization': `Bearer ${pipe.access_token}`
            },
            data: {
                "operationName": "Mutation",
                "variables":
                {
                    "data": {
                        "active": pipe.action == 'enable',
                        "name": pipe.pipeName
                    }
                },
                "query": `mutation Mutation($data: CreatePipelanePayload!, $oldPipeName: ID) {\n  createPipelane(data: $data, oldPipeName: $oldPipeName) {\n    
                        name\n    
                        active\n    
                        schedule\n    
                        input\n    
                        nextRun\n    
                        retryCount\n    
                        executionsRetentionCount\n    
                        updatedTimestamp\n    
                        __typename\n  
                }\n
                }`
            }
        }

        if (pipe.action == 'delete') {
            req.data = {
                "operationName": "DeletePipelane",
                "variables": { "name": pipe.pipeName },
                "query": "mutation DeletePipelane($name: ID!) {\n  deletePipelane(name: $name)\n}"
            }
        }
        if (pipe.action == 'trigger') {
            req.data = {
                "operationName": "executePipelane",
                "variables": { "name": pipe.pipeName, "input": JSON.stringify(pipe.trigger_inputs || {}) }, "query": "mutation executePipelane($name: ID!, $input: String!) {\n  executePipelane(name: $name, input: $input) {\n    id\n    __typename\n  }\n}"
            }
        }
        return req
    }

    async execute(pipeWorkInstance: PipeLane, input: any): Promise<any[]> {

        let pipeManagerInput: PipeManagerInput[] = []
        if (input.last && input.last.length > 0) {
            pipeManagerInput.push(...input.last)
        }
        if (input.additionalInputs?.pipeName) {
            pipeManagerInput.push(input.additionalInputs)
        }

        const promises = []
        for (let pipe of pipeManagerInput) {
            if (pipe.pipeName) {
                if (!pipe.action) {
                    pipe.action = 'enable'
                }
                let request: any = this.getConfig(pipe)
                promises.push(axios(request).then(res => {
                    res.data.status = true
                    return res.data
                }).catch(e => {
                    pipe.status = false
                    pipe.message = e.message
                    return pipe
                }))

            }
        }

        return await Promise.all(promises)

    }

}