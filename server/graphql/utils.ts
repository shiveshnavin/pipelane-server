import { MultiDbORM } from "multi-db-orm"
import PipeLane, { InputWithPreviousInputs, OutputWithStatus, PipeTask, TaskVariantConfig } from "pipelane"
import { Pipelane, Pipetask, PipetaskExecution, Status } from "../../gen/model"

export function generateTaskTypeResolvers(variantConfig: TaskVariantConfig) {
    return {
        TaskType: {
            description: (parent) => {
                let types: PipeTask<any, any>[] = variantConfig[parent.type] || []
                let anyType = types[0]
                return anyType.describe()
            },
            variants: (parent) => {
                if (parent.variants)
                    return parent.variants
                let types: PipeTask<any, any>[] = variantConfig[parent.type] || []
                return types.map(pt => pt.getTaskVariantName())
            }
        },
        Query: {
            TaskType: async (parent, arg) => {
                let types: PipeTask<any, any>[] = variantConfig[arg.type] || []
                return {
                    type: arg.type,
                    variants: types.map(pt => pt.getTaskVariantName())
                }
            },
            taskTypes: () => {
                return Object.keys(variantConfig).map(vt => {
                    return {
                        type: vt
                    }
                })
            }
        }
    }
}


export function getTasksExecFromPipelane(cached: PipeLane) {
    let executedTasks = (cached.executedTasks as PipeTask<InputWithPreviousInputs, OutputWithStatus>[])
    return executedTasks.map(p => {
        let pltExec = {} as PipetaskExecution
        pltExec.name = p.uniqueStepName || p.taskVariantName || p.taskTypeName
        pltExec.pipelaneExId = cached.instanceId
        pltExec.pipelaneName = cached.name
        pltExec.status = mapStatus('TASK_FINISHED', p.outputs as OutputWithStatus[])
        pltExec.startTime = `${p.startTime}`
        pltExec.endTime = `${p.endTime}`
        pltExec.id = `${cached.instanceId}::${p.uniqueStepName}`
        pltExec.output = JSON.stringify(p.outputs || [])
        return pltExec
    })
}


export function mapStatus(event, output: ({ status: Status } & any)[]): Status {
    if (event == 'SKIPPED')
        return Status.Skipped
    let isAtleaseOneFail = (output as any[] || []).find(o => !o.status)
    let isAtleaseOneSuccess = (output as any[] || []).find(o => o.status)
    let status = Status.Success
    if (isAtleaseOneFail) {
        status = Status.PartialSuccess
    }
    if (!isAtleaseOneSuccess) {
        status = Status.Failed
    }
    return status
}