import { ApolloClient, InMemoryCache, ApolloProvider, gql, ApolloQueryResult } from '@apollo/client';
import {
    CreatePipelanePayload, CreatePipetaskPayload, Pipelane, Pipetask
} from '../../../gen/model';
import { Platform } from 'react-native';
let HOST = Platform.OS == 'web' ? 'http://localhost:4001' : 'http://192.168.0.115:4001'
if (!__DEV__) {
    HOST = 'http://oci.semibit.in:4001'
}
const client = new ApolloClient({
    uri: HOST + '/graph',
    cache: new InMemoryCache(),
});

export function getGraphErrorMessage(error: any) {
    try {
        if (error?.networkError?.result)
            error = error.networkError.result
        else if (error.message) {
            return error.message
        }
        if (error.errors && error.errors.length > 0) {
            return error.errors.map((e: any) => {
                return e.message
            }).join(". ")
        }
    } catch (e) {
        return "An error occurred"
    }
    return undefined
}

export class Api {
    graph = client

    SAMPLE_PIPELANE: Pipelane = {
        name: 'new',
        active: true,
        input: `{}`,
        retryCount: 0,
        executionsRetentionCount: 5,
        schedule: '0 8 * * *',
        tasks: [],
    }
    SAMPLE_PIPETASK: Pipetask = {
        name: 'new',
        taskTypeName: 'new',
        taskVariantName: 'new',
        active: true,
        input: `{}`,
        pipelaneName: 'new',
        isParallel: false
    }
    upsertPipelaneTask(task: CreatePipetaskPayload) {
        this.graph.resetStore()
        return this.graph.mutate({
            mutation: gql`mutation Mutation($data: CreatePipetaskPayload!) {
                createPipelaneTask(data: $data) {
                  name
                  pipelaneName
                  taskTypeName
                  taskVariantName
                  active
                  isParallel
                  step
                  input
                }
              }`,
            variables: {
                data: task
            }
        })
    }
    upsertPipelane(pipe: CreatePipelanePayload) {
        this.graph.resetStore()
        return this.graph.mutate({
            mutation: gql`mutation Mutation($data: CreatePipelanePayload!) {
                createPipelane(data: $data) {
                  name
                  active
                  schedule
                  input
                  nextRun
                  retryCount
                  executionsRetentionCount
                  updatedTimestamp
                }
              }`,
            variables: {
                data: pipe
            }
        })
    }
    getPipelaneTasks(pipeName: string) {
        return this.graph.query({
            query: gql`
                query PipelaneTasks($pipelaneName: ID!) {
                        pipelaneTasks(pipelaneName: $pipelaneName) {
                            name
                            pipelaneName
                            taskVariantName
                            taskTypeName
                            isParallel
                            step
                            input
                            active
                        }
                    }
`,
            variables: { pipelaneName: pipeName },
        })
    }
    getPipelane(pipeName: string, getTasks?: Boolean) {
        return this.graph.query({
            query: gql`
                query Pipelane($name: ID!) {
                        Pipelane(name: $name) {
                            name
                            input
                            schedule
                            active
                            nextRun
                            retryCount
                            executionsRetentionCount
                            updatedTimestamp
                            ${getTasks ? `
                                tasks {
                                pipelaneName
                                taskVariantName
                                taskTypeName
                                isParallel
                                step
                                input
                                }`: ''}
                        }
                    }
`,
            variables: { name: pipeName },
        })
    }

    getPipetask(name: string, pipelaneName: string) {
        return this.graph.query({
            query: gql`
                        query PipeTasks($name: ID!, $taskVariantName: ID!, $pipelaneName: ID!) {
                        Pipetask(name: $name, pipelaneName: $pipelaneName) {
                            name
                            pipelaneName
                            taskVariantName
                            taskTypeName
                            isParallel
                            step
                            input
                            active
                        }
                        }
                                    
                        `,
            variables: {
                "name": name,
                "pipelaneName": pipelaneName
            },
        })
    }

    deletePipelane(name: string) {
        this.graph.resetStore()
        return this.graph.mutate({
            mutation: gql`mutation DeletePipelane($name: ID!) {
                deletePipelane(name: $name)
              }
              `,
            variables: {
                name
            }
        })
    }

    deletePipelaneTask(pipelaneName: string, name: string) {
        this.graph.resetStore()
        return this.graph.mutate({
            mutation: gql`
            mutation DeletePipelaneTask($pipelaneName: ID!, $name: ID!) {
                deletePipelaneTask(pipelaneName: $pipelaneName, name: $name)
              }
              `,
            variables: {
                pipelaneName,
                name
            }
        })
    }
}