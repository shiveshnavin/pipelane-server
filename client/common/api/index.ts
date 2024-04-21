import { ApolloClient, InMemoryCache, ApolloProvider, gql, ApolloQueryResult, DefaultOptions } from '@apollo/client';
import {
    CreatePipelanePayload, CreatePipetaskPayload, Pipelane, Pipetask
} from '../../../gen/model';
import { Platform } from 'react-native';
let HOST = Platform.OS == 'web' ? 'http://localhost:4001' : 'http://192.168.0.115:4001'
if (!__DEV__) {
    HOST = 'http://oci.semibit.in:4001'
}

const defaultOptions: DefaultOptions = {
    watchQuery: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'ignore',
    },
    query: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'all',
    },
}
const client = new ApolloClient({
    uri: HOST + '/graph',
    cache: new InMemoryCache(),
    defaultOptions: defaultOptions,
});

export function getGraphErrorMessage(error: any) {
    try {
        console.log(error)
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
    clearCache() {
        this.graph.clearStore()
    }
    upsertPipelaneTask(task: CreatePipetaskPayload) {
        this.clearCache()
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
        this.clearCache()
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
        this.clearCache()
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

    executePipelane(name: string, input: string) {
        this.clearCache()
        return this.graph.mutate({
            mutation: gql`mutation executePipelane($name: ID!, $input: String!) {
                executePipelane(name: $name, input: $input){
                    id
                }
              }
              `,
            variables: {
                name,
                input
            }
        })
    }

    deletePipelaneTask(pipelaneName: string, name: string) {
        this.clearCache()
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

    executions() {
        return this.graph.query({
            query: gql`
                query Executions {
                    executions {
                        id
                        name
                        startTime
                        status
                        endTime
                    }
                }
            `
        })
    }

    pipelaneExecution(id: string) {
        return this.graph.query({
            query: gql`
                query Execution($id: ID!) {
                    PipelaneExecution(id: $id) {
                        id
                        name
                        output
                        startTime
                        status
                        endTime
                        tasks {
                            id
                            name
                            output
                            startTime
                            status
                            endTime
                        }
                    }
                }
            `,
            variables: {
                id
            }
        })
    }

    pipelaneExecutions(pipelaneName: string) {
        return this.graph.query({
            query: gql`
                query Executions($pipelaneName: ID!) {
                    pipelaneExecutions(pipelaneName: $pipelaneName) {
                        id
                        name
                        startTime
                        status
                        endTime
                    }
                }
            `,
            variables: {
                pipelaneName
            }
        })
    }
}