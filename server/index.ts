import express from "express";
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import path from "path";
import fs from 'fs'
import { generateResolvers } from "./graphql/resolvers";
import { initialzeDb } from "./db";
import { TaskVariantConfig } from "pipelane";
import { CronScheduler } from "./cron";
import { generatePipelaneResolvers } from "./graphql/pipelane";
import { MultiDbORM, MySQLDBConfig } from "multi-db-orm";

const app = express()
//see https://docs.expo.dev/more/expo-cli/#hosting-with-sub-paths
//cd client && npx expo export
const ui = express.Router()
ui.all('*',
  express.static(path.join(__dirname, '../client/dist')), (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'))
  })

export async function creatPipelaneServer(
  variantConfig: TaskVariantConfig,
  persistance?: MultiDbORM | MySQLDBConfig
) {

  let db
  //@ts-ignore
  if (persistance.getOne != undefined) {
    //@ts-ignore
    db = initialzeDb(persistance)
    //@ts-ignore
  } else if (persistance.host != undefined) {
    //@ts-ignore
    db = initialzeDb(undefined, persistance)
  } else {
    throw new Error('Unable to intialize pipelane server. persistance must be either and instance of MultiDbORM or MySQLDBConfig')
  }

  const cronScheduler = new CronScheduler(variantConfig)
  const resolvers = generateResolvers(db, variantConfig, cronScheduler)
  const pipelaneResolver = generatePipelaneResolvers(db, variantConfig)
  pipelaneResolver.Query.pipelanes().then(pls => {
    cronScheduler.init(pls, pipelaneResolver)
    cronScheduler.startAll()
    console.log('pipelane:Scheduled', pls.length, 'pipes')
  }).catch(err => {
    console.error('pipelane:Error initializing pipelanes. ', err.message)
  })

  const typeDefs = fs.readFileSync(path.join(__dirname, '../', 'model.graphql')).toString()
  const appoloServer = new ApolloServer({
    typeDefs,
    resolvers,
  })
  await appoloServer.start()
  app.use('/graph', express.json(), expressMiddleware(appoloServer));
  app.use(ui)
  let services: PipelaneServerServices = {
    db: db,
    cron: cronScheduler,
    //@ts-ignore
    resolvers: resolvers
  }
  app.set('services', services)
  return app
}


//@ts-ignore
let dummyResolver = generatePipelaneResolvers({}, {})
export type PipelaneServerServices = {
  db: MultiDbORM,
  cron: CronScheduler,
  resolvers: typeof dummyResolver
}