import { ApolloClient, InMemoryCache, ApolloProvider, gql, ApolloQueryResult, DefaultOptions } from '@apollo/client';
import {
    CreatePipelanePayload, CreatePipetaskPayload, Pipelane, Pipetask
} from '../../../gen/model';
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
    graph: ApolloClient<any>
    constructor(apolloClient: ApolloClient<any>) {
        this.graph = apolloClient
    }
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
        // this.graph.clearStore()
    }
    upsertPipelaneTask(task: CreatePipetaskPayload, oldTaskName: string) {
        this.clearCache()
        return this.graph.mutate({
            mutation: gql`mutation Mutation($data: CreatePipetaskPayload!, $oldTaskName: ID) {
                createPipelaneTask(data: $data, oldTaskName: $oldTaskName) {
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
                oldTaskName: oldTaskName,
                data: task
            }
        })
    }
    upsertPipelane(pipe: CreatePipelanePayload, oldPipeName?: String) {
        this.clearCache()
        return this.graph.mutate({
            mutation: gql`mutation Mutation($data: CreatePipelanePayload!, $oldPipeName: ID) {
                createPipelane(data: $data, oldPipeName: $oldPipeName) {
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
                oldPipeName,
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
    clonePipelane(name: string) {
        this.clearCache()
        return this.graph.mutate({
            mutation: gql`mutation clonePipelane($name: ID!) {
                clonePipelane(name: $name) {
                    name
                }
              }
              `,
            variables: {
                name
            }
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


    stopPipelaneExecution(id: string) {
        return this.graph.mutate({
            mutation: gql`
                mutation Execution($id: ID!) {
                    stopPipelane(id: $id) {
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

export function createApiClient(host?: string) {
    const client = new ApolloClient({

        uri: (host ? host : '') + '/pipelane/graph',
        cache: new InMemoryCache(),
        defaultOptions: defaultOptions,
    });
    return new Api(client)
}


/**
* Recursively removes a specified field from an object.
*
* @param obj The object to remove the field from.
* @param fieldName The name of the field to remove.
* @returns The object with the specified field removed recursively.
*/
export function removeFieldRecursively<T>(obj: T, fieldName: string): T {
    // If the object is null or not an object type, return it as is.
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    // If the object is an array, iterate through it and apply the function to each element.
    if (Array.isArray(obj)) {
        return obj.map(item => removeFieldRecursively(item, fieldName)) as T;
    }

    // If the object is a regular object, iterate through its keys.
    const newObj: any = {};
    for (const key in obj) {
        // Check if the key is directly on the object (not inherited).
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            // If the current key matches the fieldName, skip it (effectively removing it).
            if (key === fieldName) {
                continue;
            }

            // Get the value of the current key.
            const value = obj[key];

            // Recursively call the function on the value if it's an object or array.
            newObj[key] = removeFieldRecursively(value, fieldName);
        }
    }

    return newObj as T;
}
