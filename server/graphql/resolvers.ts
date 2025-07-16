import { MultiDbORM } from "multi-db-orm"
import { TaskVariantConfig } from "pipelane"
import { generateTaskTypeResolvers } from "./utils"
import { generatePipelaneResolvers } from "./pipelane"
import _ from 'lodash'
import { CronScheduler } from "../cron"

export function generateResolvers(
    db: MultiDbORM,
    variantConfig: TaskVariantConfig,
    cronScheduler?: CronScheduler) {
    const resolvers = [
        generateTaskTypeResolvers(variantConfig),
        generatePipelaneResolvers(db, variantConfig, cronScheduler)
    ];

    let resolver = {}
    resolvers.forEach(r => {
        resolver = _.defaultsDeep(resolver, r)
    })

    return resolver
}
