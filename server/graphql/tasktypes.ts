import { MultiDbORM } from "multi-db-orm"
import { PipeTask, TaskVariantConfig } from "pipelane"

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
