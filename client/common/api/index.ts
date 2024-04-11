import { ApolloClient, InMemoryCache, ApolloProvider, gql } from '@apollo/client';
const client = new ApolloClient({
    uri: 'http://localhost:4000/graph',
    cache: new InMemoryCache(),
});

export class Api {
    graph = client
}