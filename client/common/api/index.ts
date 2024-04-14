import { ApolloClient, InMemoryCache, ApolloProvider, gql } from '@apollo/client';
const client = new ApolloClient({
    uri: 'http://localhost:4000/graph',
    cache: new InMemoryCache(),
});

export class Api {
    graph = client

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
                        }
                    }
`,
            variables: { pipelaneName: pipeName },
        })
    }
    getPipelane(pipeName: string, getTasks?: Boolean) {
        return this.graph.query({
            query: gql`
                query Pipelane($name: ID) {
                        Pipelane(name: $name) {
                            name
                            inputs
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
}