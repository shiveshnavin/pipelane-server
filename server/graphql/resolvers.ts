import { MultiDbORM } from "multi-db-orm"
import { TaskVariantConfig } from "pipelane"
import { generateTaskTypeResolvers } from "./tasktypes"
import { generatePipelaneResolvers } from "./pipelane"
import _ from 'lodash'
export function generateResolvers(db: MultiDbORM, variantConfig: TaskVariantConfig) {
    const resolvers = [
        generateTaskTypeResolvers(variantConfig),
        generatePipelaneResolvers(db, variantConfig)
    ];

    let resolver = {}
    resolvers.forEach(r => {
        resolver = _.defaultsDeep(resolver, r)
    })

    return resolver
}
