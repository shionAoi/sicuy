const resolvers = require('./resolvers');
const types = require('./types');
const queries = require('./queries');
const mutations = require('./mutations');

module.exports = {
    typeDefs: [
        ...types.types,
        ...queries.queries,
        ...mutations.mutations
    ],
    resolvers
}