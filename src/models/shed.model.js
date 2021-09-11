const ObjectID = require('mongodb').ObjectID;
const redis = require('../utils/redis');
const config = require('../config');
const logger = require('../utils/winston');

/**
 * Model definition shed in database
 * @typedef Shed
 * @property {ID}      id
 * @property {string}  name
 * @property {string}  details
 * @property {string}  code
 * @property {date}    created_date
 * @property {date}    updated_date
 * @property {boolean} active
 * @property {int}     male_number_cuys
 * @property {int}     female_number_cuys
 * @property {int}     children_number_cuys
 * @property {int}     total_number_cuys
 */

/**
 * Success/Error return object
 * @typedef DAOResponse
 * @property {boolean} [success] - Success
 * @property {string} [error] - Error
*/

let sheds

const Genre = {
    MALE: "male",
    FEMALE: "female",
    CHILDREN: "children"
}

class ShedDAO {
    static async injectDB(conn) {
        if (sheds) {
            return
        }
        try {
            sheds = await conn.db(config.MONGO_DB_NAME).collection("sheds");
        } catch (error) {
            logger.error(`Unable to establish collection handles in shedDAO: ${error}`);
        }
    }

    static async createIndexes() {
        try {
            await sheds.createIndex({ code: 1 }, { unique: true });
        } catch (error) {
            logger.error(`Error creating indexes shedDAO ${error}`);
        }
    }

    /**
     * Adds shed to the collection `sheds`
     * @param {shedInfo} shedInfo - The shed to add
     * @returns {DAOResponse} Returns either a success or an error
     */
    static async addShed(shedInfo) {
        try {
            // Default fields
            shedInfo["created_date"] = new Date();
            shedInfo["active"] = true;
            shedInfo["male_number_cuys"] = 0;
            shedInfo["female_number_cuys"] = 0;
            shedInfo["children_number_cuys"] = 0;
            shedInfo["total_number_cuys"] = 0;
            // Insert shed in collection `sheds`
            await sheds.insertOne(shedInfo);
            // Update cache
            await redis.incKeyBy("db_total_number_sheds_active", 1);
            await redis.setKey(shedInfo["_id"].toHexString() + "_active", "true");
            // Return success
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in addShed ${error}`);
            throw error
        }
    }

    /**
     * Updates a shed by its _id in collection `sheds`
     * @param {string} idShed - ID of shed to be updated
     * @param {object} update - Object with params to update
     * @returns {DAOResponse} Returns either a "success" or an error
     */
    static async updateShed(idShed, update) {
        let id
        try {
            // Create ObjectID from idShed
            id = new ObjectID.createFromHexString(idShed);
            // Update shed
            update = update || {}
            update["updated_date"] = new Date();
            const updateResponse = await sheds.updateOne(
                { "_id": id },
                { "$set": update }
            )
            // Verify if shed was updated
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No shed found with that _id')
            }
            // Return success
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in updateShed ${error}`);
            throw error
        }
    }

    static async getGenre(word) {
        word = word.toUpperCase();
        word = word.toUpperCase();
        if (word.search("MACHO") !== -1) {
            word = "male_number_cuys"
        } else if (word.search("HEMBRA") !== -1) {
            word = "female_number_cuys"
        } else {
            word = "children_number_cuys"
        }
        return word
    }

    /**
     * Increments or Decrements number of cuys in collection `sheds`
     * @param {string} idShed - ID of shed to update
     * @param {Genre} genre - Genre to increment or decrement quantity
     * @param {number} quantity - Quantity to inc or dec
     * @returns {DAOResponse} Returns either a "success" or an error
     */
    static async updateNumberOfCuysInShedByGenre(idShed, genre, quantity = 1) {
        let id
        try {
            // Create ObjectID from idShed
            id = new ObjectID.createFromHexString(idShed);
            // Get genre male, female or child
            genre = await this.getGenre(genre);
            let update = {};
            update[genre] = quantity;
            // Update quantity of field and total_number_cuys
            const updateResponse = await sheds.updateOne(
                { "_id": id },
                {
                    "$set": {
                        "updated_date": new Date(),
                    },
                    "$inc": {
                        ...update,
                        "total_number_cuys": quantity
                    }
                }
            )
            // Verify if shed was updated
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No shed found with that _id')
            }
            // Return success
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in updateNumberOfCuysInShedByGenre ${error}`);
            throw error
        }
    }

    /**
     * Updates population of shed when genre of cuy changes
     * @param {string} idShed - ID of shed
     * @param {Genre} oldGenre - Old genre of cuy
     * @param {Genre} newGenre - New genre of cuy
     * @returns {DAOResponse} Returns either a success or an error
     */
    static async updateShedChangeGenreCuy(idShed, oldGenre, newGenre) {
        let id
        try {
            // Create ObjectID from idShed
            id = new ObjectID.createFromHexString(idShed);
            // Get source genres male, female or child
            oldGenre = await this.getGenre(oldGenre);
            newGenre = await this.getGenre(newGenre);
            if (oldGenre === newGenre) {
                throw new Error('No update of genre cuy')
            }
            let update = {};
            update[oldGenre] = -1;
            update[newGenre] = 1;
            // Update quantity of field and total_number_cuys
            const updateResponse = await sheds.updateOne(
                { "_id": id },
                {
                    "$set": {
                        "updated_date": new Date(),
                    },
                    "$inc": {
                        ...update,
                    }
                }
            )
            // Verify if shed was updated
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No shed found with that _id')
            }
            // Return success
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in updateShedChangeGenreCuy ${error}`);
            throw error
        }
    }

    /**
     * Increments or decrements number of male,female and children cuys in a shed
     * when a pool was deleted
     * @param {string} idShed - ID of shed
     * @param {number} male - number of male
     * @param {number} female - number of female
     * @param {number} children - number of children
     * @returns {DAOResponse} Returns either a success or an error
     */
    static async updateNumberOfPopulationInShed(
        idShed,
        male,
        female,
        children
    ) {
        let idS
        try {
            // Validate idShed
            if (!ObjectID.isValid(idShed)) {
                throw new Error('Error. Invalid ID of shed')
            }
            // Create ObjectID from idShed
            idS = new ObjectID.createFromHexString(idShed);
            // Update shed
            const updateResponse = await sheds.updateOne(
                { "_id": idS },
                {
                    "$set": {
                        "updated_date": new Date(),
                    },
                    "$inc": {
                        "male_number_cuys": male,
                        "female_number_cuys": female,
                        "children_number_cuys": children,
                        "total_number_cuys": male + female + children
                    }
                }
            )
            // Verify if shed was updated
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No shed found with that _id')
            }
            // Return success
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in updateNumberOfPopulationInShed ${error}`);
            throw error
        }
    }

    /**
     * Removes shed from collection `sheds`
     * @param {string} idShed - ID of shed to be deleted
     * @returns {DAOResponse} Returns either a "success" or an error
     */
    static async deleteShed(idShed) {
        let id
        try {
            // Create ObjectID from idShed
            id = new ObjectID.createFromHexString(idShed);
            // Delete shed by its _id
            await sheds.deleteOne({ "_id": id })
            // Verify if shed was deleted
            if (!(await this.verifyShedExists(idShed))) {
                await redis.deleteAllKeysPrefix(idShed);
                await redis.decKeyBy("db_total_number_sheds_inactive", 1);
                return { success: true }
            } else {
                throw new Error('Deletion unsuccessful')
            }
        } catch (error) {
            console.log(error.message);
            logger.error(`Something went wrong in deleteShed ${error}`);
            throw error
        }
    }

    static async verifyShedExists(idShed) {
        let idS
        try {
            // Create ObjectID from idShed
            idS = new ObjectID.createFromHexString(idShed)
            // Return shed
            const shed = await sheds.findOne({ "_id": idS });
            if (!shed) {
                return false
            }
            return true
        } catch (error) {
            logger.error(`Something went wrong in verifyShedExists ${error}`);
            throw error
        }
    }

    /**
     * Updates and deactivates shed by its _id in collection `sheds`
     * @param {string} idShed - ID of shed to be updated
     * @returns {DAOResponse} Returns either a "success" or an error
     */
    static async deactivateShed(idShed) {
        let id
        try {
            // Validate idShed
            if (!ObjectID.isValid(idShed)) {
                throw new Error('Error. Invalid ID of shed')
            }
            // Create ObjectID from idShed
            id = new ObjectID.createFromHexString(idShed);
            // Deactivate shed
            const updateResponse = await sheds.updateOne(
                { "_id": id, "active": true },
                {
                    "$set": {
                        "active": false,
                        "updated_date": new Date(),
                    }
                }
            )
            // Verify if shed was updated
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No active shed found')
            }
            // Update cache
            await redis.incKeyBy("db_total_number_sheds_inactive", 1);
            await redis.decKeyBy("db_total_number_sheds_active", 1);
            await redis.setKey(idShed + "_active", "false");
            // Return success
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in deactivateShed ${error}`);
            throw error
        }
    }

    /**
     * Updates and activates shed by its _id in collection `sheds`
     * @param {string} idShed - ID of shed to be updated
     * @returns {DAOResponse} Returns either a "success" or an error
     */
    static async activateShed(idShed) {
        let id
        try {
            // Create ObjectID from idShed
            id = new ObjectID.createFromHexString(idShed);
            // Deactivate shed
            const updateResponse = await sheds.updateOne(
                { "_id": id, "active": false },
                {
                    "$set": {
                        "active": true,
                        "updated_date": new Date(),
                        "male_number_cuys": 0,
                        "female_number_cuys": 0,
                        "children_number_cuys": 0,
                        "total_number_cuys": 0
                    }
                }
            )
            // Verify if shed was updated
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No inactive shed found')
            }
            // Update cache
            await redis.incKeyBy("db_total_number_sheds_active", 1);
            await redis.decKeyBy("db_total_number_sheds_inactive", 1);
            await redis.setKey(idShed + "_active", "true");
            // Return success
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in activateShed ${error}`);
            throw error
        }
    }

    /**
     * Finds and return a shed by its _id
     * @param {string} idShed - ID of shed to find
     * @returns {shed | null} Returns either a shed or error
     */
    static async getShedById(idShed) {
        let idS
        try {
            // Create ObjectID from idShed
            idS = new ObjectID.createFromHexString(idShed)
            // Return shed
            const shed = await sheds.findOne({ "_id": idS });
            if (!shed) {
                throw new Error('No shed found with that _id')
            }
            return shed
        } catch (error) {
            logger.error(`Something went wrong in getShedById ${error}`);
            throw error
        }
    }

    /**
     * Finds and return a shed by its _id
     * @param {string} idShed - ID of shed to find
     * @param {boolean} filter - Filter active or inactive shed
     * @returns {shed | null} Returns either a shed or error
     */
    static async getShedByIdFilter(idShed, filter = true) {
        let idS, query
        try {
            // Create ObjectID from idShed
            idS = new ObjectID.createFromHexString(idShed);
            // Generate query
            query = filter ? { "_id": idS, "active": true } : { "_id": idS, "active": false };
            // Return shed
            const shed = await sheds.findOne(query);
            if (!shed) {
                throw new Error('No shed found with that _id')
            }
            return shed
        } catch (error) {
            logger.error(`Something went wrong in addPoolToShed ${error}`);
            throw error
        }
    }

    /**
     * Finds and returns all sheds in collection `sheds`
     * @param {boolean} filter - Get only active or inactive shed
     * @param {number} offset - Return sheds after offset
     * @param {number} shedsPerPage - Return n sheds
     * @returns {[shed]} Returns a list of sheds
     */
    static async getAllShedsPagination(
        filter = true,
        offset = 0,
        shedsPerPage = 20,
    ) {
        let cursor, displayCursor, query
        try {
            // Generate query
            query = filter ? { "active": true } : { "active": false };
            // Find all shed filtering by query
            cursor = await sheds.find(query);
        } catch (error) {
            logger.error(`Something went wrong in getAllShedsPagination ${error}`);
            return []
        }
        displayCursor = cursor;
        if (shedsPerPage !== -1) {
            displayCursor = cursor.limit(shedsPerPage).skip(offset);
        }
        try {
            return await displayCursor.toArray()
        } catch (error) {
            logger.error(`Something went wrong in getAllShedsPagination ${error}`);
            return []
        }
    }

    /**
     * Finds and returns total number of sheds (active or inactive) in collection `sheds`
     * @param {boolean} filter - Filter active or inactive sheds
     * @returns {number | error} Returns either number or an error
     */
    static async getTotalNumberSheds(filter = true) {
        // Generate query
        const query = filter ? { "active": true } : { "active": false };
        // Generate key to search in cache
        const key = filter ? "db_total_number_sheds_active" : "db_total_number_sheds_inactive";
        try {
            // Verify key already in cache
            let totalNumSheds = await redis.getValueOfKey(key);
            if (!totalNumSheds) {
                // Consult in db
                totalNumSheds = await sheds.countDocuments(query);
                // Set cache
                await redis.setKey(key, totalNumSheds)
            }
            return totalNumSheds
        } catch (error) {
            logger.error(`Something went wrong in getTotalNumberSheds ${error}`);
            return 0
        }
    }

    /**
     * Finds and projects total death, alive and saca cuys by sheds
     * @returns {[shed]} Returns a list of sheds with numbers
     */
    static async getStatisticsTable() {
        const pipeline = [
            {
                "$lookup": {
                    "from": "pools",
                    "localField": "_id",
                    "foreignField": "shed",
                    "as": "pools"
                }
            },
            {
                "$lookup": {
                    "from": "cuys",
                    "localField": "pools._id",
                    "foreignField": "pool",
                    "as": "cuys"
                }
            },
            {
                "$project": {
                    "name": 1,
                    "details": 1,
                    "code": 1,
                    "alive_cuys": {
                        "$filter": {
                            "input": "$cuys",
                            "as": "cuy",
                            "cond": { "$not": [{ "$not": ["$$cuy.active"] }] }
                        }
                    },
                    "dead_cuys": {
                        "$filter": {
                            "input": "$cuys",
                            "as": "cuy",
                            "cond": { "$not": [{ "$not": ["$$cuy.death"] }] }
                        }
                    },
                    "saca_cuys": {
                        "$filter": {
                            "input": "$cuys",
                            "as": "cuy",
                            "cond": { "$not": [{ "$not": ["$$cuy.saca"] }] }
                        }
                    }
                }
            },
            {
                "$project": {
                    "name": 1,
                    "details": 1,
                    "code": 1,
                    "alive_cuys": { "$size": "$alive_cuys" },
                    "dead_cuys": { "$size": "$dead_cuys" },
                    "saca_cuys": { "$size": "$saca_cuys" }
                }
            }
        ]
        let cursor
        try {
            cursor = await sheds.aggregate(pipeline);
            return await cursor.toArray()
        } catch (error) {
            logger.error(`Something went wrong in getTotalNumberSheds ${error}`);
            throw error
        }
    }
}

module.exports = ShedDAO;