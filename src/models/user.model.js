const ObjectID = require('mongodb').ObjectID;
const config = require('../config');
const logger = require('../utils/winston');

let users

/**
 * Model definition user in database
 * @typedef User
 * @property {ID}     id
 * @property {string} names
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} dni
 * @property {string} photo
 * @property {string} email
 * @property {string} phone
 * @property {string} password
 * @property {[ID]}   roles
 * @property {Access} accessLifeCycle
 */

/**
 * Model definition access
 * @typedef Access
 * @property {boolean} active
 * @property {boolean} inactive
 */

/**
 * Success/Error return object
 * @typedef DAOResponse
 * @property {boolean} [success] - Success
 * @property {string} [error] - Error
 */

class UserDAO {
    static async injectDB(conn) {
        if (users) {
            return
        }
        try {
            users = await conn.db(config.MONGO_DB_NAME).collection("users");
        } catch (e) {
            logger.error(`Unable to establish collection handles in userDAO: ${e}`);
        }
    }

    static async createIndexes() {
        try {
            await users.createIndex({ email: 1 }, { unique: true })
        } catch (error) {
            logger.error(`Error creating indexes userDAO ${error}`);
        }
    }

    /**
     * Adds a user to the collection `users`
     * @param {UserInfo} userInfo - The information of the user to add
     * @returns {DAOResponse} Returns either a "success" or an "error" Object
    */
    static async addUser(userInfo) {
        try {
            userInfo["accessLifeCycle"] = {
                "active": true,
                "inactive": false
            };
            await users.insertOne(userInfo);
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in addUser ${error}`);
            throw (error);
        }
    }

    /**
     * Updates a user by its _id in collection `users`
     * @param {string} idUser - ID of user to be updated
     * @param {Object} update - Object with params to update
     * @returns {DAOResponse} Returns either a "success" or an "error" 
     */
    static async updateUser(idUser, update) {
        let id
        try {
            if (!ObjectID.isValid(idUser)) {
                throw new Error('Error. Invalid ID of user')
            }
            id = new ObjectID.createFromHexString(idUser)
            update = update || {}
            const updateResponse = await users.updateOne(
                { "_id": id },
                { "$set": update }
            )
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No user found with that _id')
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong while updating user ${error}`);
            throw error
        }
    }

    /**
     * Updates password of user
     * @param {string} idUser - ID of user
     * @param {string} newPassword - New password of user
     * @returns {DAOResponse} Returns either a "success" or and "error"
     */
    static async updatePasswordOfUser(idUser, newPassword) {
        let id
        try {
            if (!ObjectID.isValid(idUser)) {
                throw new Error('Error. Invalid ID of user')
            }
            id = new ObjectID.createFromHexString(idUser)
            const updateResponse = await users.updateOne(
                { "_id": id },
                { "$set": { "password": newPassword } }
            )
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No user found with that _id')
            }
            return { success: true }
        } catch (error) {
            throw error
        }
    }

    /**
     * Update access of user to lifeCycle of models as shed, pool or cuy
     * @param {string} idUser - ID of user
     * @param {Access} access - Access to update
     * @returns {DAOResponse} Returns either a success or an error
     */
    static async updateAccessOfUser(idUser, access) {
        let idU, updateAccess
        try {
            if (!ObjectID.isValid(idUser)) {
                throw new Error('Error. Invalid ID of user')
            }
            idU = new ObjectID.createFromHexString(idUser);
            updateAccess = {}
            for (const key in access) {
                updateAccess["accessLifeCycle." + key] = access[key];
            }
            const updateResponse = await users.updateOne(
                { "_id": idU },
                { "$set": { ...updateAccess } }
            )
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No user found with that _id')
            }
            return { success: true }
        } catch (error) {
            throw error
        }
    }

    /**
     * Removes user from `users` collection
     * @param {string} idUser - ID of user to delete
     * @returns {DAOResponse} Returns either a "success" or an "error" 
     */
    static async deleteUser(idUser) {
        let id
        try {
            if (!ObjectID.isValid(idUser)) {
                throw new Error('Error. Invalid user _id')
            }
            id = new ObjectID.createFromHexString(idUser)
            await users.deleteOne({ "_id": id })
            if (!(await this.getUserById(idUser))) {
                return { success: true }
            } else {
                throw new Error('Deletion unsuccessful')
            }
        } catch (error) {
            logger.error(`Something went wrong while deleting user ${error}`);
            throw error
        }
    }

    /**
     * Add role to user
     * @param {string} idUser - ID of user which add role
     * @param {string} idRole - ID of role to add
     * @returns {DAOResponse} Returns either a "success" or an "error"
     */
    static async addRoleToUser(idUser, idRole) {
        let idU, idR
        try {
            if (!ObjectID.isValid(idUser) && !ObjectID.isValid(idRole)) {
                throw new Error('Params input not valid')
            }
            idU = new ObjectID.createFromHexString(idUser);
            idR = new ObjectID.createFromHexString(idRole);
            const updateResponse = await users.updateOne(
                { "_id": idU },
                { "$addToSet": { "roles": idR } }
            )
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No user found with that _id')
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong while adding role to user ${error}`);
            throw error
        }
    }

    /**
     * Deletes role of user
     * @param {string} idUser - ID of user
     * @param {string} idRole - ID of role to delete
     * @returns {DAOResponse} Returns either a "success" or an "error"
     */
    static async deleteRoleOfUser(idUser, idRole) {
        let idU, idR
        try {
            if (!ObjectID.isValid(idUser) && !ObjectID.isValid(idRole)) {
                throw new Error('Params input not valid')
            }
            idU = new ObjectID.createFromHexString(idUser);
            idR = new ObjectID.createFromHexString(idRole);
            const updateResponse = await users.updateOne(
                { "_id": idU },
                { "$pull": { "roles": idR } }
            )
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No user found with that _id')
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong while adding role to user ${error}`);
            throw error
        }
    }

    /**
     * Find and return a user by its _id.
     * @param {string} idUser - The desired use id, the _id in Mongo
     * @returns {user | null} Returns either a single user or nothing
    */
    static async getUserById(idUser) {
        let id
        try {
            if (!ObjectID.isValid(idUser)) {
                throw new Error('Error. Invalid user _id')
            }
            id = new ObjectID.createFromHexString(idUser)
            const user = await users.findOne({ _id: id });
            if (!user) {
                throw new Error('No User found with that _id')
            }
            return user
        } catch (error) {
            logger.error(`Something went wrong in getUserById ${error}`);
            throw (error);
        }
    }
    /**
     * Find and return a user by its email.
     * @param {string} email - The desired user email
     * @returns {user | null} Returns either a single user or nothing
    */
    static async getUserByEmail(email) {
        try {
            const user = await users.findOne({ email: email });
            if (!user) {
                throw new Error('No User found with that email')
            }
            return user
        } catch (error) {
            logger.error(`Something went wrong in getUserById ${error}`);
            throw (error);
        }
    }
    /**
     * Find all users
     * @returns {[user]} Returns all user
     */
    static async getAllUsers() {
        let cursor
        try {
            cursor = await users.find({})
        } catch (error) {
            logger.error(`Something went wrong in getAllUsers ${error}`);
            throw error
        }
        return cursor.toArray()
    }

    /**
     * Finds and returns all users that have a specific role
     * @param {string} idRole - Id of role to filter users
     * @returns {[user]} Returns all filtered users
     */
    static async getAllUsersByRole(idRole) {
        let cursor
        try {
            if (!ObjectID.isValid(idRole)) {
                throw new Error('Error. Invalid role _id')
            }
            let id = new ObjectID.createFromHexString(idRole)
            cursor = await users.find({
                "roles": id
            })
        } catch (error) {
            logger.error(`Something went wrong in getAllUsersByRole ${error}`);
            throw error
        }
        return cursor.toArray()
    }
}

module.exports = UserDAO;