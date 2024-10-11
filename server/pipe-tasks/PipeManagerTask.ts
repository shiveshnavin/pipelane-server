import axios from "axios";
import { method } from "lodash";
//@ts-ignore
import PipeLane, { PipeTask } from "pipelane";


/**
 * input : { 
 *      last:[{ pipeName , action: enable | disable. access_token }], 
 *      additionalInputs: { pipeName , action: enable | disable, access_token } 
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

        let pipeManagerInput: {
            pipeName: string,
            action: "enable" | "disable",
            access_token: string,
            status: boolean
        }[] = []
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
                let request = {
                    method: 'post',
                    url: "https://stocks.semibit.in/pipelane/graph",
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
                promises.push(axios(request).then(res => {
                    pipe.status = true
                    return pipe
                }).catch(e => {
                    pipe.status = false
                    return pipe
                }))

            }
        }

        return await Promise.all(promises)

    }

}