import { ApolloClient, InMemoryCache, ApolloProvider, gql, ApolloQueryResult } from '@apollo/client';
import { CreatePipelaneInput, CreatePipetaskInput, Pipelane } from '../../../gen/model';
const client = new ApolloClient({
    uri: 'http://localhost:4000/graph',
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

    upsertPipelaneTask(task: CreatePipetaskInput) {
        return this.graph.mutate({
            mutation: gql`mutation Mutation($data: CreatePipetaskInput!) {
                createPipelaneTask(data: $data) {
                  pipelaneName
                  taskTypeName
                  taskVariantName
                  active
                  isParallel
                  input
                }
              }`,
            variables: {
                data: task
            }
        })
    }
    upsertPipelane(pipe: CreatePipelaneInput) {
        return this.graph.mutate({
            mutation: gql`mutation Mutation($data: CreatePipelaneInput!) {
                createPipelane(data: $data) {
                  name
                  active
                  schedule
                  input
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
                            pipelaneName
                            taskVariantName
                            taskTypeName
                            isParallel
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
                            ${getTasks ? `
                                tasks {
                                pipelaneName
                                taskVariantName
                                taskTypeName
                                isParallel
                                input
                                }`: ''}
                        }
                    }
`,
            variables: { name: pipeName },
        })
    }

    getPipetask(pipelaneName: string, taskVariantName: string) {
        return this.graph.query({
            query: gql`
 query PipeTasks($taskVariantName: ID!, $pipelaneName: ID!) {
  Pipetask(taskVariantName: $taskVariantName, pipelaneName: $pipelaneName) {
    pipelaneName
    taskVariantName
    taskTypeName
    isParallel
    input
    active
  }
}
               
`,
            variables: {
                "pipelaneName": pipelaneName,
                "taskVariantName": taskVariantName
            },
        })
    }
}