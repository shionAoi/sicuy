const ObjectID = require('mongodb').ObjectID;
const config = require('../config');
const logger = require('../utils/winston');

let operations

/**
 * Model definition operation in database
 * @typedef Operation
 * @property {ID}     id
 * @property {string} name
 * @property {string} description
 * @property {int}   type
*/

/**
 * Success/Error return object
 * @typedef DAOResponse
 * @property {boolean} [success] - Success
 * @property {string} [error] - Error
*/

class OperationDAO {
    static async injectDB(conn) {
        if (operations) {
            return
        }
        try {
            operations = await conn.db(config.MONGO_DB_NAME).collection("operations");
        } catch (e) {
            logger.error(`Unable to establish collection handles in operationDAO: ${e}`);
        }
    }
    /** 
     * Update or add operations in collection when server is started
     * @param {[operation]} ops - List of operations to update or add
     * @returns {DAOResponse} returns either a success or an error 
     */
    static async initOperations(ops) {
        try {
            if (!Array.isArray(ops)) {
                throw new Error(`Error. Param not array`)
            }
            for (const operation of ops) {
                await operations.updateOne(
                    { "_id": operation._id },
                    { "$set": operation },
                    { "upsert": true }
                );
            }
        } catch (error) {
            logger.error(`Something went wrong on initOperations ${error}`);
            throw error
        }
    }

    /**
     * Finds and returns operations from array of IDs
     * @param {[ID]} ids - List of IDS
     * @returns {[operation]} Return a list of operations
     */
    static async getOperationsByIds(ids) {
        let cursor
        try {
            if (!Array.isArray(ids)) {
                throw new Error('Error list not array')
            }
            cursor = await operations.find({
                "_id": { "$in": ids }
            })
        } catch (error) {
            logger.error(`Unable to issue find command ${error}`);
            return []
        }
        return cursor.toArray()
    }

    /**
     * Finds and returns a operation by its _id
     * @param {string} idOperation - Id of operation
     * @returns {operation | null} Returns either a single role or error
     */
    static async getOperationById(idOperation) {
        try {
            if (!ObjectID.isValid(idOperation)) {
                throw new Error('Error. ID of operation not valid')
            }
            let idO = new ObjectID.createFromHexString(idOperation);
            const operation = await roles.findOne({ "_id": idO });
            if (!operation) {
                throw new Error('No operation found with that _id')
            }
            return operation
        } catch (error) {
            logger.error(`Something went wrong in getOperationById ${error}`);
            throw error
        }
    }

    static async getOperationByName(name) {
        try {
            const operation = await roles.findOne({ "name": name });
            if (!operation) {
                throw new Error('No operation found with that name')
            }
            return operation
        } catch (error) {
            logger.error(`Something went wrong in getOperationByName ${error}`);
            throw error
        }
    }

    /**
     * Finds and returns all operations in collection `operations`
     * @returns {[operation]} Returns a list of operations
     */
    static async getAllOperations() {
        let cursor
        try {
            cursor = await operations.find({})
        } catch (error) {
            logger.error(`Something went wrong in getAllOperations ${error}`);
            throw error
        }
        return cursor.toArray()
    }
}

module.exports = OperationDAO;