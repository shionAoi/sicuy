const { gql, SchemaDirectiveVisitor, AuthenticationError } = require('apollo-server-express');
const { defaultFieldResolver } = require('graphql');
const redis = require('../../utils/redis');
const RoleDAO = require('../../models/role.model');
const OperationDAO = require('../../models/operation.model');

const typeDef = gql`
  directive @isAuthenticated on FIELD_DEFINITION
`

class IsAuthenticatedDirective extends SchemaDirectiveVisitor {
    visitFieldDefinition(field) {
        const { resolve = defaultFieldResolver } = field

        field.resolve = async function (...args) {
            try {
                const context = args[2]

                if (!context || !context.user) {
                    throw new AuthenticationError('Not allowed')
                }
                // Get operation id from cache
                var opId = await redis.getOperationByName(field.name);
                if (!opId) {
                    opId = await (await OperationDAO.getOperationByName(field.name))._id.toHexString();
                    // Set Cache
                    await redis.setKey(field.name, opId);
                }
                // If operation _id not in cache not allow operation
                if (context.user.roles.length !== 0) {
                    // Get list of operations of user from cache
                    let opsOfUser = await redis.getOperationsOfUser(context.user._id);
                    // If operations in cache
                    if (opsOfUser !== undefined && opsOfUser.length != 0) {
                        // If user don't have permissions to operation
                        if (!opsOfUser.includes(opId)) {
                            throw new AuthenticationError('Not Allowed')
                        }
                    } else {
                        // Get list of operations of user from DB
                        var dbOps = await RoleDAO.getOperationsByRoles(context.user.roles);
                        // Add operations of user to cache
                        for (const operation of dbOps.operations) {
                            await redis.pushOperationOfUser(operation.toHexString(), context.user._id.toHexString());
                        }
                        // Set time out to cache of user
                        await redis.setTimeOut(context.user._id.toHexString() + "_operation", 900);
                        // Verify if user allowed to operation
                        var permission = false;
                        dbOps.operations.forEach(element => {
                            if (element.toHexString() === opId) {
                                permission = true
                            }
                        });
                        if (!permission) {
                            throw new AuthenticationError('Not Allowed')
                        }
                    }
                } else {
                    throw new AuthenticationError('Not allowed. Error')
                }
                return resolve.apply(this, args)
            } catch (error) {
                throw error
            }
        }
    }
}

module.exports = {
    typeDef,
    directive: IsAuthenticatedDirective
}