const mongo = require('mongodb');
const { ApolloError, ForbiddenError } = require('apollo-server-express');
const roleDao = require('../../../models/role.model');
const userDAO = require('../../../models/user.model');
const redis = require('../../../utils/redis');

const ObjectID = mongo.ObjectID;

/**
  * Query resolve, rolesParent filter roles array of IDs to
  * only include roles from parent User.
  * @argument {parent} parent - user parent
  * @returns {[role]} Returns a list of roles
*/
const roleParent = async parent => {
    try {
        return await roleDao.getRolesByIds(parent.roles);
    } catch (error) {
        throw new Error(`Error. ${error}`)
    }
}

/**
 * Mutation resolve, addRole adds a role in db
 * @argument {RoleInput} role - Object input
 * @returns {role} Returns added role
 */
const addRole = async (_, { role }) => {
    try {
        role["_id"] = new ObjectID();
        role["operations"] = [];
        const success = await roleDao.addRole(role);
        if (!success) {
            throw new ApolloError('Error. Something went wrong in addRole')
        }
        return role
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, updateRole updates a role in db
 * @argument {ID} idRole - ID of role to be updated
 * @argument {RoleUpdate} role - Object to set
 * @returns {role} Returns updated role
 */
const updateRole = async (_, { idRole, role }) => {
    try {
        await roleDao.updateRole(idRole, role);
        return await roleDao.getRoleById(idRole)
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, deleteRole deletes a role in db
 * @argument {ID} idRole - ID of role to be deleted
 * @returns {boolean} Returns true if deleted
 */
const deleteRole = async (_, { idRole }) => {
    try {
        const usersByRole = await userDAO.getAllUsersByRole(idRole);
        if (usersByRole !== undefined && usersByRole.length !== 0) {
            throw new ForbiddenError('Forbidden. Role is being used by user, delete role from user first')
        }
        const { success } = await roleDao.deleteRole(idRole)
        return success
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, addOperationToRole adds operation to role in db
 * @argument {ID} idRole - ID of role
 * @argument {ID} idOperation - ID of operation to add
 * @returns {boolean} Returns true if deleted
 */
const addOperationToRole = async (_, { idRole, idOperation }) => {
    try {
        const {success} = await roleDao.addOperationToRole(idRole, idOperation);
        if (success) {
            const users = await userDAO.getAllUsersByRole(idRole);
            if (users !== undefined && users.length !== 0) {
                await redis.updateUserOperationsByList(users, idOperation)
            }
            return success
        } else {
            throw new Error('Something went wrong while adding operation to role')
        }
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, deleteOperationOfRole deletes operation in role
 * @argument {ID} idRole - ID of role
 * @argument {ID} idOperation - ID of operation to delete
 * @returns {boolean} Returns true if deleted
 */
const deleteOperationOfRole = async (_, { idRole, idOperation }) => {
    try {
        const {success} = await roleDao.deleteOperationOfRole(idRole, idOperation)
        if (success) {
            const users = await userDAO.getAllUsersByRole(idRole);
            if (users !== undefined && users.length !== 0) {
                await redis.deleteUserOperationsByList(users, idOperation)
            }
            return success
        } else {
            throw new Error('Something went wrong while deleting operation to role')
        }
    } catch (error) {
        throw error
    }
}

/**
  * Query resolve, roleById finds and returns a role by its ID.
  * @argument {String} idRole - role Id
  * @returns {role} Returns role
*/
const roleById = async (_, { idRole }) => {
    try {
        return await roleDao.getRoleById(idRole)
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve, roles finds and returns all roles
 * @returns {[role]} Return list of roles
 */
const roles = async (_, args) => {
    try {
        return await roleDao.getAllRoles()
    } catch (error) {
        throw error
    }
}

module.exports = {
    queries: {
        roleById,
        roles
    },
    mutations: {
        addRole,
        updateRole,
        deleteRole,
        addOperationToRole,
        deleteOperationOfRole
    },
    roleParent,
}