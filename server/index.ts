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

app.use('/pipelane/config', (req, res) => {
  res.status(200).send({
    host: req.hostname
  })
})
// Remove in production
app.get("/", (_req, res) => {
  res.redirect('/pipelane')
})


//see https://docs.expo.dev/more/expo-cli/#hosting-with-sub-paths
//cd client && npx expo export
const ui = express.Router()
ui.all('*',
  express.static(path.join(__dirname, '../client/dist')), (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'))
  })

export default async function creatPipelaneServer(
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

  const cronScheduler = new CronScheduler()
  const resolvers = generateResolvers(db, variantConfig, cronScheduler)
  const pipelaneResolver = generatePipelaneResolvers(db, variantConfig)
  pipelaneResolver.Query.pipelanes().then(pls => {
    cronScheduler.init(pls, pipelaneResolver)
    cronScheduler.startAll()
    console.log('Scheduled', pls.length, 'pipes')
  }).catch(err => {
    console.error('Error initializing pipelanes. ', err.message)
  })

  const typeDefs = fs.readFileSync(path.join(__dirname, '../', 'model.graphql')).toString()
  const appoloServer = new ApolloServer({
    typeDefs,
    resolvers,
  })
  await appoloServer.start()
  app.use('/pipelane/graph', express.json(), expressMiddleware(appoloServer));
  app.use('/pipelane', ui)
  return app
}