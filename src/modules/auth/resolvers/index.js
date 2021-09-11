const userResolvers = require('./user');
const roleResolvers = require('./role');
const { operationParent, operationById, operations } = require('./operation');

const resolvers = {
    Query: {
        ...userResolvers.queries,
        ...roleResolvers.queries,
        operationById,
        operations
    },
    User: {
        roles: roleResolvers.roleParent,
    },
    Role: {
        operations: operationParent,
    },
    Mutation: {
        ...userResolvers.mutations,
        ...roleResolvers.mutations
    }
}

module.exports = resolvers;