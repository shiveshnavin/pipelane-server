import express from "express";
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import path from "path";
import fs from 'fs'
import { generateResolvers } from "./graphql/resolvers";
import db from "./db";
import { TaskVariantConfig } from "pipelane";
import { CronScheduler } from "./cron";
import { generatePipelaneResolvers } from "./graphql/pipelane";

const app = express()

//see https://docs.expo.dev/more/expo-cli/#hosting-with-sub-paths
//cd client && npx expo export
const ui = express.Router()
ui.all('*',
  express.static(path.join(__dirname, '../client/dist')), (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'))
  })
app.use('/ui', ui)

// Remove in production
app.get("/", (_req, res) => {
  res.redirect('/graph')
})

export default async function creatPipelaneServer(variantConfig: TaskVariantConfig) {

  const cronScheduler = new CronScheduler()
  const resolvers = generateResolvers(db, variantConfig, cronScheduler)
  const pipelaneResolver = generatePipelaneResolvers(db, variantConfig)
  pipelaneResolver.Query.pipelanes().then(pls => {
    cronScheduler.init(pls, async (pipeName) => {
      let pipelane = await pipelaneResolver.Query.Pipelane({}, {
        name: pipeName
      })
      pipelane.tasks = await pipelaneResolver.Query.pipelaneTasks({}, {
        pipelaneName: pipeName
      })
      return pipelane
    })
    cronScheduler.startAll()
    console.log('Scheduled', pls.length, 'pipes')
  })

  const typeDefs = fs.readFileSync('model.graphql').toString()
  const appoloServer = new ApolloServer({
    typeDefs,
    resolvers,
  })


  return new Promise((resolve) => {
    appoloServer.start().then(() => {
      app.use('/graph', express.json(), expressMiddleware(appoloServer));
      resolve(app)
    })
  })
}