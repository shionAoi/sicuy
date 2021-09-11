const { GraphQLScalarType, Kind } = require('graphql')
const { gql } = require('apollo-server-express')

const typeDef = gql`
  scalar DateTime
`

const DateTime = new GraphQLScalarType({
    name: 'DateTime',
    description: 'A DateTime representation in ISO format',
    parseValue(value) {
        // value from the client
        return new Date(value)
    },
    serialize(value) {
        // value sent to the client
        return value instanceof Date ? value.toISOString() : null
    },
    parseLiteral(ast) {
        return ast.kind === Kind.STRING ? this.parseValue(ast.value) : null
    }
})

module.exports = {
    typeDef,
    resolvers: {
        DateTime
    }
}