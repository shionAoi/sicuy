const redis = require('redis');
const { promisifyAll } = require('bluebird');
const config = require('../config');
const ObjectID = require('mongodb').ObjectID;
const logger = require('./winston');

promisifyAll(redis);

let client

class RedisClient {
    static async runRedis() {
        if (client) {
            return
        }
        try {
            client = redis.createClient({
                url: config.REDIS_URL,
                password: config.REDIS_PASSWORD,
            });
            await client.flushdbAsync();
        } catch (error) {
            logger.error(`Unable to establish connection to redis. ${error}`);
            throw error
        }
    }
    /**
     * Push a list of operations in cache
     * @param {[operation]} operations - List of operations
     * @returns {ClientResponse} Returns either a success or error response
     */
    static async setOperationsList(operations) {
        try {
            if (!Array.isArray(operations)) {
                throw new Error('Error. Operations not an array')
            }
            for (var operation of operations) {
                await client.setAsync(operation.name, operation._id.toHexString())
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in setOperationsList Redis ${error}`);
            throw (error);
        }
    }
    /**
     * Push operation of user in cache
     * @param {string} idOperation - Id of operation to push
     * @param {string} idUser - String of user's id
     * @returns {ClientResponse} Returns either a success or an error
     */
    static async pushOperationOfUser(idOperation, idUser) {
        try {
            await client.saddAsync(idUser + "_operation", idOperation);
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong with pushOperationOfUser redis ${error}`);
            throw error
        }
    }

    /**
     * Update all users operation when a operation was added to a role
     * @param {[users]} users - List of users to update in cache
     * @param {string} idOperation - Id of operation to add in redis
     * @returns {ClientResponse} Returns either a success or an error
     */
    static async updateUserOperationsByList(users, idOperation) {
        try {
            let id
            for (const user of users) {
                id = user._id.toHexString()
                var userExists = await this.verifyKey(id + "_operation");
                if (userExists) {
                    await this.pushOperationOfUser(idOperation, id)
                }
            }
        } catch (error) {
            logger.error(`Something went wrong with updateUserOperationsByList redis ${error}`);
            throw error
        }
    }

    /**
     * Delete operation of user in cache
     * @param {string} idUser - ID of user
     * @param {string} idOperation - ID of operation to delete
     * @returns {ClientResponse} Returns either success or an error
     */
    static async delOperationOfUser(idUser, idOperation) {
        try {
            await client.sremAsync(idUser, idOperation);
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong with delOperationOfUser redis ${error}`);
            throw error
        }
    }

    /**
     * Deletes operation of all users when a operation was added to a role
     * @param {[users]} users - List of users to update in cache
     * @param {string} idOperation - Id of operation to add in redis
     * @returns {ClientResponse} Returns either a success or an error
     */
    static async deleteUserOperationsByList(users, idOperation) {
        try {
            let id
            for (const user of users) {
                id = user._id.toHexString()
                var userExists = await this.verifyKey(id + "_operation");
                if (userExists) {
                    await this.delOperationOfUser(id + "_operation", idOperation)
                }
            }
        } catch (error) {
            logger.error(`Something went wrong with updateUserOperationsByList redis ${error}`);
            throw error
        }
    }

    /**
     * Delete operation from all keys *_operation
     */
    static async delOperationOfAllUsers(idOperation) {
        try {
            const keys = await this.getAllKeysSuffix("_operation")
            if (keys !== undefined && keys.length !== 0) {
                for (const key of keys) {
                    await this.delOperationOfUser(key, idOperation)
                }
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong with delOperationOfAllUsers redis ${error}`);
            throw error
        }
    }

    /**
     * Get operation _id from redis
     * @param {string} name - Name of operations (mutation or query)
     * @returns {_id} ID of operation
     */
    static async getOperationByName(name) {
        try {
            return await client.getAsync(name)
        } catch (error) {
            logger.error(`Something went wrong in getOperationByName redis ${error}`);
            throw error
        }
    }

    /**
     * Finds and returns list of operations of user
     * @param {ObjectID} idUser - ID of user
     * @returns {[Operation]} Returns a list of user's operations 
     */
    static async getOperationsOfUser(idUser) {
        let id
        try {
            id = idUser.toHexString()
            return await client.smembersAsync(id + "_operation")
        } catch (error) {
            logger.error(`Something went wrong in getOperationsOfUser redis ${error}`);
            throw error
        }
    }

    /**
     * Gets all keys with a suffix
     * @param {string} suffix - Suffix pattern
     * @returns {keys} Returns a list of keys
     */
    static async getAllKeysSuffix(suffix) {
        try {
            return await client.keysAsync("*" + suffix)
        } catch (error) {
            logger.error(`Something went wrong in getAllKeysSuffix redis ${error}`);
            throw error
        }
    }

    /**
     * Deletes all keys with a prefix
     * @param {string} prefix - Prefix pattern of keys to delete
     * @returns {ClientResponse} Returns either success or and error
     */
    static async deleteAllKeysPrefix(prefix) {
        try {
            const keys = await client.keysAsync(prefix + "*")
            if (keys !== undefined && keys.length != 0) {
                for (const key of keys) {
                    await this.deleteKey(key)
                }
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in deleteAllKeysPrefix redis ${error}`);
            throw error
        }
    }

    static async incKeyBy(key, inc) {
        try {
            const exists = await this.verifyKey(key)
            if (exists) {
                await client.incrbyAsync(key, inc)
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in incKeyBy redis ${error}`);
            throw error
        }
    }

    static async decKeyBy(key, dec) {
        try {
            const number = await this.getValueOfKey(key);
            if (number !== null && number - dec > -1) {
                return await client.decrbyAsync(key, dec)
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in decKeyBy redis ${error}`);
            throw error
        }
    }

    // General consults

    /**
     * Set key in redis
     * @param {string} key - key
     * @param {object} value - value
     * @returns {ClientResponse} Returns success or error
     */
    static async setKey(key, value) {
        try {
            return await client.setAsync(key, value)
        } catch (error) {
            logger.error(`Something went wrong in setKey redis ${error}`);
            throw error
        }
    }

    /**
     * Get value of key in redis
     * @param {string} key - key
     * @returns {value} Returns value of key
     */
    static async getValueOfKey(key) {
        try {
            return await client.getAsync(key)
        } catch (error) {
            logger.error(`Something went wrong in getValueOfKey redis ${error}`);
            throw error
        }
    }

    /**
     * Sets a time out on key
     * @param {string} key - Key to set timeout in seconds
     * @param {int} time - Time to set in seconds
     * @returns {ClientResponse} Returns either success or an error
     */
    static async setTimeOut(key, time) {
        try {
            await client.expireAsync(key, time)
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in setTimeOut redis ${error}`);
            throw error
        }
    }

    /**
     * Deletes a key
     * @param {string} key - Key to delete
     * @returns {ClientResponse} Returns either success or and error
     */
    static async deleteKey(key) {
        try {
            await client.delAsync(key);
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in deleteKey redis ${error}`);
            throw error
        }
    }

    /**
     * Deletes all keys of a list and their deviates
     * @param {[string]} listKeys - List of keys
     * @returns {ClientResponse} Returns either a success or an error
     */
    static async deleteListKeysPrefix(listKeys) {
        try {
            for (const key of listKeys) {
                await this.deleteAllKeysPrefix(key);
            }
            return { success: true }
        } catch (error) {

        }
    }

    /**
     * Verify if a key exists in redis
     * @param {string} key - Key to verify
     * @returns {ClientResponse} Returns either a success or an error
     */
    static async verifyKey(key) {
        try {
            return await client.existsAsync(key)
        } catch (error) {
            logger.error(`Something went wrong in verifyKey redis ${error}`);
            throw error
        }
    }
}

module.exports = RedisClient;