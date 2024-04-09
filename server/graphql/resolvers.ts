import { MultiDbORM } from "multi-db-orm"
import { TaskVariantConfig } from "pipelane"
import { generateTaskTypeResolvers } from "./tasktypes"
import { generatePipelaneResolvers } from "./pipelane"

export function generateResolvers(db: MultiDbORM, variantConfig: TaskVariantConfig) {
    const resolvers = [
        generateTaskTypeResolvers(variantConfig),
        generatePipelaneResolvers(db, variantConfig)
    ];

    const resolver = {}
    resolvers.forEach(r => {
        Object.assign(resolver, r)
    })

    return resolver
}
