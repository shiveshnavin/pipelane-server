import { GraphQLError } from "graphql";

export class ValidationGraphQLError extends GraphQLError {
    constructor(message: string, errorCode: string = 'BAD_USER_INPUT') {
        super(message, { extensions: { code: errorCode } });
    }
}