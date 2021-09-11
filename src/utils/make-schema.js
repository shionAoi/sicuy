const { gql, makeExecutableSchema } = require('apollo-server-express');
const deepmerge = require('deepmerge');

const graphql = require('../graphql');

const globalTypeDefs = gql`
  type Query
  type Mutation
`

const makeExecutableSchemaFromModules = ({
    modules
}) => {
    let typeDefs = [
        globalTypeDefs,
        ...graphql.scalars.typeDefs,
        ...graphql.directives.typeDefs
    ]

    let resolvers = {
        ...graphql.scalars.resolvers,
    }

    modules.forEach(module => {
        typeDefs = [
            ...typeDefs,
            ...module.typeDefs
        ]

        resolvers = deepmerge(resolvers, module.resolvers)
    })

    return makeExecutableSchema({
        typeDefs,
        resolvers,
        schemaDirectives: {
            ...graphql.directives.schemaDirectives
        }
    })
}

module.exports = {
    makeExecutableSchemaFromModules
}