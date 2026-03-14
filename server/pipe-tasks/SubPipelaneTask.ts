import PipeLane, { PipeTask, InputWithPreviousInputs, OutputWithStatus, PipeTaskDescription } from "pipelane";
import { CronScheduler, PipelaneExecutionListener } from "../cron";
import { Status } from "../../gen/model";

export type SubPipelaneInput = InputWithPreviousInputs & {
    last?: any[]
    additionalInputs?: any
}

const waiting: Map<string, { resolve: (val: any) => void }> = new Map()
const killRequests: Set<string> = new Set()

export class SubPipelaneTask extends PipeTask<SubPipelaneInput, any> {
    static TASK_VARIANT_NAME: string = "sub-pipelane"
    static TASK_TYPE_NAME: string = "sub-pipelane"

    cron: CronScheduler

    constructor(cronScheduler: CronScheduler, variantName?: string) {
        super(SubPipelaneTask.TASK_TYPE_NAME, variantName || SubPipelaneTask.TASK_VARIANT_NAME)
        this.cron = cronScheduler

        const listener: PipelaneExecutionListener = (pipelaneInstance, event, task, output, plx) => {
            try {
                // if any waiter is waiting for this instanceId, resolve them
                const iid = pipelaneInstance.instanceId

                // if a kill was requested for this child, attempt to stop it immediately
                if (iid && killRequests.has(iid)) {
                    try {
                        pipelaneInstance.stop()
                    } catch (e) {
                        console.error('[sub-pipelane] error attempting to stop child', e.message)
                    }
                }



                const parentId = pipelaneInstance.inputs?.parentPipeInstanceId
                if (parentId) {
                    // map to status
                    let mappedStatus: Status | undefined = undefined
                    if (event === 'KILLED') {
                        mappedStatus = Status.Skipped
                    } else if (event === 'COMPLETE') {
                        // determine success/fail from output
                        try {
                            const o0 = (output && Array.isArray(output)) ? output[0] : undefined
                            if (o0 && o0.status === false) mappedStatus = Status.Failed
                            else mappedStatus = Status.Success
                        } catch (e) {
                            mappedStatus = Status.Success
                        }
                    } else if (event === 'TASK_FINISHED') {
                        // ignore
                    }

                    if (mappedStatus) {
                        let newOutput = output || pipelaneInstance.lastTaskOutput
                        if (mappedStatus === Status.Failed || mappedStatus === Status.Skipped) {
                            newOutput = (newOutput || [{}]).map((op: any) => {
                                return {
                                    ...op, message: `Child pipelane ${iid} ${mappedStatus.toLowerCase()}. Original Message= ${op.message || ''}`, status: false
                                }
                            })
                        }
                        try {
                            if (iid && waiting.has(iid)) {
                                const parentWaiter = waiting.get(iid)
                                if (parentWaiter) {
                                    parentWaiter.resolve(newOutput)
                                    waiting.delete(iid)
                                    killRequests.delete(iid)
                                }
                            }
                        } catch (e) {
                            console.error('[sub-pipelane] Error while updating parent execution', e.message)
                        }
                    }
                }

            } catch (e) {
                console.error('[sub-pipelane] listener error', e.message)
            }
        }

        // register single listener named 'sub-pipelane-task'
        try {
            this.cron.attachListenerToPipelane('sub-pipelane-task', listener)
        } catch (e) {
            console.error('[sub-pipelane] failed to attach listener', e.message)
        }
    }

    describe(): PipeTaskDescription | undefined {
        return {
            summary: "Trigger and wait for one or more sub-pipelines. Inputs: either from last[] or additionalInputs. The child pipelane will receive parentPipeInstanceId in its inputs.",
            inputs: {
                additionalInputs: {
                    pipeName: "string, name of the pipelane to trigger",
                    pipeInputs: "object or JSON string, inputs passed to the child pipelane (will be parsed if string)"
                },
                last: [{ pipeName: "string", pipeInputs: "object or JSON string" }]
            }
        }
    }

    kill(): boolean {
        try {
            // request kill for all child instances currently awaited
            for (const iid of Array.from(waiting.keys())) {
                killRequests.add(iid)
            }
            return true
        } catch (e) {
            console.error('[sub-pipelane] kill error', e.message)
            return false
        }
    }

    async execute(pipeWorksInstance: PipeLane, input: SubPipelaneInput): Promise<any[]> {
        const parentId = pipeWorksInstance.instanceId
        const items: any[] = []
        if (input.last && Array.isArray(input.last) && input.last.length > 0) {
            items.push(...input.last)
        }
        if (input.additionalInputs && input.additionalInputs.pipeName) {
            items.push(input.additionalInputs)
        }

        if (items.length === 0) {
            return [{ status: false, message: 'No sub-pipelane inputs found' }]
        }
        let outputs = []
        for (const it of items) {
            const pipeName = it.pipeName || it.name
            if (!pipeName) continue
            let childInputs: any = Object.assign({}, it.pipeInputs || it.input || it.trigger_inputs || it)
            // if pipeInputs is a string parse it
            if (childInputs && typeof childInputs === 'string') {
                try {
                    childInputs = JSON.parse(childInputs)
                } catch (e) {
                    return [{ status: false, message: 'Invalid JSON in pipeInputs' }]
                }
            }
            // attach parent id
            childInputs.parentPipeInstanceId = parentId
            const childInstanceId = this.cron.createInstanceId(pipeName)
            const resultWaiter = new Promise<any>((resolve) => {
                waiting.set(childInstanceId, { resolve })
            })

            try {
                await this.cron.triggerPipelaneByName(pipeName, JSON.stringify(childInputs), undefined, childInstanceId)
            } catch (e: any) {
                return [{ status: false, message: e?.message || 'trigger failed' }]
            }

            const result = await resultWaiter
            outputs.push(...(result || []))
        }

        return outputs
    }
}
