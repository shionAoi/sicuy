const ObjectID = require('mongodb').ObjectID;
const config = require('../config');
const logger = require('../utils/winston');

let roles

/**
 * Model definition role in database
 * @typedef Role
 * @property {ID}     id
 * @property {string} name
 * @property {string} description
 * @property {[ID]}   operations
 */

/**
 * Success/Error return object
 * @typedef DAOResponse
 * @property {boolean} [success] - Success
 * @property {string} [error] - Error
*/

class RoleDAO {
    static async injectDB(conn) {
        if (roles) {
            return
        }
        try {
            roles = await conn.db(config.MONGO_DB_NAME).collection("roles");
        } catch (e) {
            logger.error(`Unable to establish collection handles in roleDAO: ${e}`);
        }
    }

    /**
     * Adds user to the collection `roles`
     * @param {roleInfo} roleInfo - The role to add
     * @returns {DAOResponse} Returns either a "success" or an "error"
     */
    static async addRole(roleInfo) {
        try {
            await roles.insertOne(roleInfo);
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in addRole ${error}`);
            throw error
        }
    }

    /**
     * Updates a role by its _id in collection `roles`
     * @param {string} idRole - ID of role to be updated
     * @param {object} update - Object with params to update
     * @returns {DAOResponse} Returns either a "success" or an error
     */
    static async updateRole(idRole, update) {
        let id
        try {
            if (!ObjectID.isValid(idRole)) {
                throw new Error('Error. Invalid ID of role')
            }
            id = new ObjectID.createFromHexString(idRole);
            update = update || {}
            const updateResponse = await roles.updateOne(
                { "_id": id },
                { "$set": update }
            )
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No role found with that _id')
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in updateRole ${error}`);
            throw error
        }
    }

    /**
     * Removes role from collection `roles`
     * @param {string} idRole - ID of role to delete
     * @returns {DAOResponse} Returns either a "success" or an "error"
     */
    static async deleteRole(idRole) {
        let id
        try {
            if (!ObjectID.isValid(idRole)) {
                throw new Error('Error. Invalid role _id')
            }
            id = new ObjectID.createFromHexString(idRole)
            await roles.deleteOne({ "_id": id })
            if (!(await this.getRoleById(idRole))) {
                return { success: true }
            } else {
                throw new Error('Deletion unsuccessful')
            }
        } catch (error) {
            logger.error(`Something went wrong in deleteRole ${error}`);
            throw error
        }
    }

    /**
     * Adds operation to role
     * @param {string} idRole - ID of role
     * @param {string} idOperation - ID of operation to add
     * @returns {DAOResponse} Returns either a "success" or an "error"
     */
    static async addOperationToRole(idRole, idOperation) {
        let idR, idO
        try {
            if (!ObjectID.isValid(idRole) && !ObjectID.isValid(idOperation)) {
                throw new Error('Params input not valid')
            }
            idR = new ObjectID.createFromHexString(idRole);
            idO = new ObjectID.createFromHexString(idOperation);
            const updateResponse = await roles.updateOne(
                { "_id": idR },
                { "$addToSet": { "operations": idO } }
            )
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No role found with that _id')
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in addOperationToRole ${error}`);
            throw error
        }
    }

    /**
     * Deletes operation from role
     * @param {string} idRole - ID of role
     * @param {string} idOperation - ID of operation to delete
     * @returns {DAOResponse} Returns either a "success" or an "error"
     */
    static async deleteOperationOfRole(idRole, idOperation) {
        let idR, idO
        try {
            if (!ObjectID.isValid(idRole) && !ObjectID.isValid(idOperation)) {
                throw new Error('Params input not valid')
            }
            idR = new ObjectID.createFromHexString(idRole);
            idO = new ObjectID.createFromHexString(idOperation);
            const updateResponse = await roles.updateOne(
                { "_id": idR },
                { "$pull": { "operations": idO } }
            )
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No role found with that _id')
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in deleteOperationOfRole ${error}`);
            throw error
        }
    }

    /**
     * Find and return a role by its _id.
     * @param {string} id - The desired use id, the _id in Mongo
     * @returns {role | null} Returns either a single role or nothing
    */
    static async getRoleById(id) {
        let idO
        try {
            if (!ObjectID.isValid(id)) {
                throw new Error('Error. ID role not valid')
            }
            idO = new ObjectID.createFromHexString(id)
            const role = await roles.findOne({ "_id": idO });
            if (!role) {
                throw new Error('No role found with that _id')
            }
            return role
        } catch (error) {
            logger.error(`Something went wrong in getUserById ${error}`);
            throw (error);
        }
    }

    /**
     * Find and return all roles
     * @returns  {[roles]} Returns a list of roles
    */
    static async getAllRoles() {
        let cursor
        try {
            cursor = await roles.find({});
        } catch (error) {
            logger.error(`Something went wrong in getAllRoles ${error}`);
            return []
        }
        return cursor.toArray()
    }

    /**
     * Finds and returns roles from array of IDs
     * @param {[ID]} ids - List of IDs
     * @returns {[roles]} Return a list of roles
     */
    static async getRolesByIds(ids) {
        let cursor
        try {
            if (!Array.isArray(ids)) {
                throw new Error('Error list not array')
            }
            cursor = await roles.find({
                "_id": { "$in": ids },
            })
        } catch (error) {
            logger.error(`Unable to issue find command ${error}`);
            return []
        }
        return cursor.toArray()
    }

    /**
     * Given a list of roles, returns a list of its operation access
     * @param {[ID]} roles - List of IDs
     * @return {[operations]} Returns a list of role's operations
     */
    static async getOperationsByRoles(rls) {
        try {
            if (!Array.isArray(rls)) {
                throw new Error('Error. Roles param is not an array')
            }
            const queryPipeline = [
                {
                    "$match": {
                        "_id": { "$in": rls }
                    },
                },
                {
                    "$unwind": "$operations"
                },
                {
                    "$group": {
                        "_id": null,
                        "operations": { "$addToSet": "$operations" }
                    }
                }
            ]
            const results = await (await roles.aggregate(queryPipeline)).next()
            return {
                ...results
            }
        } catch (error) {
            logger.error(`Something went wrong in getOperationsByRoles ${error}`);
            throw error
        }
    }
}

module.exports = RoleDAO;