const ObjectID = require('mongodb').ObjectID;
const config = require('../config');
const redis = require('../utils/redis');
const logger = require('../utils/winston');

/**
 * Model definition pool in database
 * @typedef Pool
 * @property {ID}         id
 * @property {ID}         shed
 * @property {string}     type - Enum: ["PLANTEL", "REEMPLAZO", "RECRIA", "ENGORDE"]
 * @property {string}     description
 * @property {string}     code
 * @property {date}       created_date
 * @property {date}       updated_date
 * @property {boolean}    active
 * @property {Population} population
 * @property {int}        total_population
 */

/**
 * Model definition population
 * @typedef Population
 * @property {string} genre - Enum: ["MACHO", "HEMBRA", "CRIA"]
 * @property {int}    quantity
 */

/**
 * Success/Error return object
 * @typedef DAOResponse
 * @property {boolean} [success] - Success
 * @property {string} [error] - Error
*/

let pools

class PoolDAO {
    static async injectDB(conn) {
        if (pools) {
            return
        }
        try {
            pools = await conn.db(config.MONGO_DB_NAME).collection("pools");
        } catch (error) {
            logger.error(`Unable to establish collection handles in PoolDAO: ${error}`);
        }
    }

    static async createIndexes() {
        try {
            await pools.createIndex({ shed: 1 });
            await pools.createIndex({ code: 1 }, { unique: true });
            await pools.createIndex({ active: 1 });
            await pools.createIndex({ _id: 1, active: 1 });
            await pools.createIndex({ type: 1, active: 1 });
            await pools.createIndex({ shed: 1, active: 1 });
        } catch (error) {
            logger.error(`Error creating indexes poolDAO ${error}`);
        }
    }

    static async countDocuments(filter) {
        try {
            return await pools.countDocuments(filter)
        } catch (error) {
            throw error
        }
    }

    /**
     * Adds pool to the collection `pools`
     * @param {poolInfo} poolInfo - The pool to add
     * @returns {DAOResponse} Returns either a success or an error
     */
    static async addPool(poolInfo) {
        let idShed, shedAux
        try {
            // Generate new ObjectID from shed
            shedAux = poolInfo["shed"];
            idShed = new ObjectID.createFromHexString(poolInfo["shed"]);
            // Default fields
            poolInfo["shed"] = idShed;
            poolInfo["created_date"] = new Date();
            poolInfo["active"] = true;
            poolInfo["total_population"] = 0;
            poolInfo["population"] = [];
            poolInfo["type"] = poolInfo["type"].trim().toUpperCase();
            poolInfo["phase"] = poolInfo["phase"].trim().toUpperCase();
            // Insert pool in collection
            await pools.insertOne(poolInfo);
            // Update cache
            await redis.incKeyBy("db_total_number_pools_active", 1);
            await redis.incKeyBy(shedAux + "_total_number_pools_active", 1);
            await redis.setKey(poolInfo["_id"].toHexString() + "_active", "true");
            await redis.setKey(poolInfo["_id"].toHexString() + "_shed", shedAux);
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in addPool ${error}`);
            throw error
        }
    }

    /**
     * Updates a pool by its _id in collection `pools`
     * @param {string} idPool - ID of pool to be updated
     * @param {object} update - Object with params to update
     * @returns {DAOResponse} Returns either a "success" or an error
     */
    static async updatePool(idPool, update) {
        let id
        try {
            // Generate ObjectID from idPool
            id = new ObjectID.createFromHexString(idPool);
            // Set update
            if (update["type"]) {
                update["type"] = update["type"].trim().toUpperCase();
            }
            if (update["phase"]) {
                update["phase"] = update["phase"].trim().toUpperCase();
            }
            update = update || {};
            update["updated_date"] = new Date();
            // Update pool
            const updateResponse = await pools.updateOne(
                { "_id": id },
                { "$set": update }
            )
            // Verify if pool was updated
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No pool found with that _id')
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in updatePool ${error}`);
            throw error
        }
    }

    /**
     * Removes pool from collection `pools`
     * @param {string} idPool - ID of pool to be deleted
     * @returns {DAOResponse} Returns either a "success" or an error
     */
    static async deletePool(idPool) {
        let id
        try {
            // Generate ObjectID from idPool
            id = new ObjectID.createFromHexString(idPool);
            // Get shed of pool
            let shed = await redis.getValueOfKey(idPool + "_shed");
            if (!shed) {
                shed = await (await this.getPoolById(idPool)).shed.toHexString();
            }
            // Delete pool in db
            await pools.deleteOne({ "_id": id })
            // Verify if pool was deleted
            if (!(await this.verifyPoolExists(idPool))) {
                // Update cache
                await redis.deleteAllKeysPrefix(idPool);
                await redis.decKeyBy("db_total_number_pools_inactive", 1);
                await redis.decKeyBy(shed + "_total_number_pools_inactive", 1);
                return { success: true }
            } else {
                throw new Error('Deletion unsuccessful')
            }
        } catch (error) {
            logger.error(`Something went wrong in deletePool ${error}`);
            throw error
        }
    }

    static async verifyPoolExists(idPool) {
        let idP
        try {
            // Generate ObjectID from idPool
            idP = new ObjectID.createFromHexString(idPool);
            // Return pool
            const pool = await pools.findOne({ "_id": idP });
            if (!pool) {
                return false
            }
            return true
        } catch (error) {
            logger.error(`Something went wrong in verifyPoolExists ${error}`);
            throw error
        }
    }

    /**
     * Deletes all pools by its shed
     * @param {string} idShed - ID of shed
     * @returns {DAOResponse} - Returns either a success or an error
     */
    static async deletePoolsOfShed(idShed) {
        let idS
        try {
            // Generate ObjectID from idShed
            idS = new ObjectID.createFromHexString(idShed);
            // Get number of documents to delete
            const numAct = await pools.countDocuments({ "shed": idS, "active": true });
            const numIna = await pools.countDocuments({ "shed": idS, "active": false });
            const listPools = await pools.distinct("_id", { "shed": idS });
            // Delete pools
            await pools.deleteMany({ "shed": idS });
            // Update cache
            await redis.decKeyBy("db_total_number_pools_inactive", numIna);
            await redis.decKeyBy("db_total_number_pools_active", numAct);
            await redis.decKeyBy(idShed + "_total_number_pools_inactive", numIna);
            await redis.decKeyBy(idShed + "_total_number_pools_active", numAct);
            for (const id of listPools) {
                await redis.deleteAllKeysPrefix(id.toHexString())
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in deletePoolsOfShed ${error}`);
            throw error
        }
    }

    /**
     * Updates and deactivates pool by its _id in collection `pools`
     * @param {string} idPool - ID of pool to be updated
     * @returns {DAOResponse} Returns either a "success" or an error
     */
    static async deactivatePool(idPool) {
        let id
        try {
            // Generate ObjectID from idPool
            id = new ObjectID.createFromHexString(idPool);
            // Get pool to obtain shed
            let shed = await redis.getValueOfKey(idPool + "_shed");
            if (!shed) {
                shed = await (await this.getPoolById(idPool)).shed.toHexString();
                // Set cache
                await redis.setKey(idPool + "_shed", shed);
            }
            // Update pool
            await pools.updateOne(
                { "_id": id },
                {
                    "$set": {
                        "active": false,
                        "updated_date": new Date(),
                    }
                }
            )
            await redis.incKeyBy("db_total_number_pools_inactive", 1);
            await redis.decKeyBy("db_total_number_pools_active", 1);
            await redis.incKeyBy(shed + "_total_number_pools_inactive", 1);
            await redis.decKeyBy(shed + "_total_number_pools_active", 1);
            await redis.setKey(idPool + "_active", "false");
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in deactivatePool ${error}`);
            throw error
        }
    }

    /**
     * Deactivates all pools by its shed
     * @param {string} idShed - ID of shed
     * @returns {DAOResponse} - Returns either a success or an error
     */
    static async deactivatePoolsOfShed(idShed) {
        let idS
        try {
            // Generate ObjectID from idShed
            idS = new ObjectID.createFromHexString(idShed);
            // Get number of updated documents
            const num = await pools.countDocuments({ "shed": idS, "active": true });
            // Get IDs of pools to update
            const list = await pools.distinct("_id", { "shed": idS, "active": true });
            // Update pools
            await pools.updateMany(
                { "shed": idS, "active": true },
                {
                    "$set": {
                        "active": false,
                        "updated_date": new Date(),
                    }
                }
            )
            // Update cache
            await redis.incKeyBy("db_total_number_pools_inactive", num);
            await redis.decKeyBy("db_total_number_pools_active", num);
            await redis.incKeyBy(idShed + "_total_number_pools_inactive", num);
            await redis.decKeyBy(idShed + "_total_number_pools_active", num);
            for (const id of list) {
                await redis.setKey(id.toHexString() + "_active", "false")
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in deactivatePoolsOfShed ${error}`);
            throw error
        }
    }

    /**
     * Updates and activates pool by its _id in collection `pools`
     * @param {string} idPool - ID of pool to be updated
     * @returns {DAOResponse} Returns either a "success" or an error
     */
    static async activatePool(idPool) {
        let id
        try {
            // Generate ObjectID from idPool
            id = new ObjectID.createFromHexString(idPool);
            // Get pool to obtain shed
            const shed = await redis.getValueOfKey(idPool + "_shed");
            // Update pool
            await pools.updateOne(
                { "_id": id },
                {
                    "$set": {
                        "active": true,
                        "updated_date": new Date(),
                        "population.$[].quantity": 0,
                        "total_population": 0
                    }
                }
            )
            await redis.incKeyBy("db_total_number_pools_active", 1);
            await redis.decKeyBy("db_total_number_pools_inactive", 1);
            await redis.incKeyBy(shed + "_total_number_pools_active", 1);
            await redis.decKeyBy(shed + "_total_number_pools_inactive", 1);
            await redis.setKey(idPool + "_active", "true");
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in activatePool ${error}`);
            throw error
        }
    }

    /**
     * Activates all pools by its shed
     * @param {string} idShed - ID of shed
     * @returns {DAOResponse} - Returns either a success or an error
     */
    static async activatePoolsOfShed(idShed) {
        let idS
        try {
            // Validate idShed
            if (!ObjectID.isValid(idShed)) {
                throw new Error('Error. Invalid idShed')
            }
            // Generate ObjectID from idShed
            idS = new ObjectID.createFromHexString(idShed);
            // Get number of updated documents
            const num = await pools.countDocuments({ "shed": idS, "active": false });
            // Get IDs of pools to update
            const list = await pools.distinct("_id", { "shed": idS, "active": false });
            // Update pools
            await pools.updateMany(
                { "shed": idS, "active": false },
                {
                    "$set": {
                        "active": true,
                        "updated_date": new Date(),
                        "population.$[].quantity": 0
                    }
                }
            )
            // Update cache
            await redis.incKeyBy("db_total_number_pools_active", num);
            await redis.decKeyBy("db_total_number_pools_inactive", num);
            await redis.incKeyBy(idShed + "_total_number_pools_active", num);
            await redis.decKeyBy(idShed + "_total_number_pools_inactive", num);
            for (const id of list) {
                await redis.setKey(id.toHexString() + "_active", "true")
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in activatePoolsOfShed ${error}`);
            throw error
        }
    }

    /**
     * Updates population of pool when a cuy was added or death
     * @param {string} idPool - ID of pool to update numbers
     * @param {string} genre - Genre of cuy. i.e. MACHO, HEMBRA, CRIA
     * @param {number} quantity - Int representing number of increment or decrement
     * @returns {DAOResponse} Returns either a success or an error
     */
    static async updatePopulationOfPool(idPool, genre, quantity = 1) {
        let idP, totalPopulation
        try {
            // Generate ObjectID from idPool
            idP = new ObjectID.createFromHexString(idPool);
            // Get old population of Pool
            const poolObject = await this.getPoolById(idPool);
            // Define new population to update
            let newPopulation = [];
            // Define new total_population to update
            totalPopulation = poolObject.total_population || 0;
            totalPopulation += quantity;
            // Validate totalPopulation not negative
            if (totalPopulation < 0) {
                throw new Error(`Error. Total number of cuys  ${totalPopulation} under 0`)
            }
            // trim genre input
            genre = genre.trim().toUpperCase();
            // if not elements in old population
            if (poolObject.population.length === 0) {
                if (quantity < 0) {
                    throw new Error(`Error. Number of genre ${genre} under 0`)
                }
                // Only add new population
                newPopulation.push({
                    "genre": genre,
                    "quantity": quantity
                });
            } else {
                // Var to search repeated object in old population
                var repeatedObject = {
                    "genre": genre,
                    "quantity": quantity
                }
                // Foreach genre in old population
                poolObject.population.forEach(element => {
                    // If genre not equal to genre input
                    if (element.genre !== genre) {
                        newPopulation.push({
                            "genre": element.genre,
                            "quantity": element.quantity
                        })
                    } else {
                        // If genre already in old population update quantity
                        repeatedObject.quantity += element.quantity;
                    }
                });
                // Verify repeatedObject not negative
                if (repeatedObject.quantity < 0) {
                    throw new Error(`Error. Number of genre ${genre} under 0`)
                }
                // Finally push repeatedObject
                newPopulation.push(repeatedObject);
            }
            // Update Pool population in db
            const updateResponse = await pools.updateOne(
                { "_id": idP },
                {
                    "$set": {
                        "population": newPopulation,
                        "total_population": totalPopulation,
                        "updated_date": new Date()
                    }
                }
            )
            // Verify pool was updated
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No pool found with that _id')
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in updatePopulationOfPool ${error}`);
            throw error
        }
    }

    static async updatePoolChangeGenreCuy(idPool, oldGenre, newGenre) {
        let idP
        try {
            // Generate ObjectID from idPool
            idP = new ObjectID.createFromHexString(idPool);
            // Get old population of Pool
            const poolObject = await this.getPoolById(idPool);
            // Define new population to update
            let newPopulation = [];
            // trim genre input
            newGenre = newGenre.trim().toUpperCase();
            // if not elements in old population
            if (poolObject.population.length === 0) {
                // Only add new population
                newPopulation.push({
                    "genre": newGenre,
                    "quantity": 1
                });
            } else {
                // Var to search repeated object in old population
                var repeatedObject = {
                    "genre": newGenre,
                    "quantity": 1
                }
                // Foreach genre in old population
                poolObject.population.forEach(element => {
                    // Decrease oldGenre
                    if (element.genre === oldGenre) {
                        newPopulation.push({
                            "genre": element.genre,
                            "quantity": element.quantity - 1
                        })
                    } else if (element.genre !== newGenre) {
                        newPopulation.push({
                            "genre": element.genre,
                            "quantity": element.quantity
                        })
                    } else {
                        // If genre already in old population update quantity
                        repeatedObject.quantity += element.quantity;
                    }
                });
                // Finally push repeatedObject
                newPopulation.push(repeatedObject);
            }
            // Update Pool population in db
            const updateResponse = await pools.updateOne(
                { "_id": idP },
                {
                    "$set": {
                        "population": newPopulation,
                        "updated_date": new Date()
                    }
                }
            )
            // Verify pool was updated
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No pool found with that _id')
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in updatePopulationOfPool ${error}`);
            throw error
        }
    }
    /**
     * Updates total population of pool
     * @param {string} idPool - ID of pool
     * @param {number} total_population - New total_population
     * @param {Population} population - New Population
     * @returns {DAOResponse} Returns either a success or an error
     */
    static async updateTotalPopulationOfPool(idPool, total_population, population) {
        let idP
        try {
            // Verify if population is valid
            if (!Array.isArray(population)) {
                throw new Error('Error. Invalid population')
            }
            // Generate ObjectID from idPool
            idP = new ObjectID.createFromHexString(idPool);
            // Update Pool population in db
            const updateResponse = await pools.updateOne(
                { "_id": idP },
                {
                    "$set": {
                        "population": population,
                        "total_population": total_population,
                        "updated_date": new Date()
                    }
                }
            )
            // Verify pool was updated
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No pool found with that _id')
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in updateTotalPopulationOfPool ${error}`);
            throw error
        }
    }

    /**
     * Finds and return a pool by its _id
     * @param {string} idPool - ID of pool to find
     * @returns {pool | null} Returns either a pool or error
     */
    static async getPoolById(idPool) {
        let idP
        try {
            // Generate ObjectID from idPool
            idP = new ObjectID.createFromHexString(idPool);
            // Return pool
            const pool = await pools.findOne({ "_id": idP });
            if (!pool) {
                throw new Error('No pool found with that _id')
            }
            return pool
        } catch (error) {
            logger.error(`Something went wrong in getPoolById ${error}`);
            throw error
        }
    }

    /**
     * Finds and return a pool by its _id
     * @param {string} idPool - ID of pool to find
     * @param {boolean} filter - Filter active or inactive pool
     * @returns {pool | null} Returns either a pool or error
     */
    static async getPoolByIdFilter(idPool, filter = true) {
        let idP, query
        try {
            // Generate ObjectID from idPool
            idP = new ObjectID.createFromHexString(idPool);
            // Generate query
            query = filter ? { "_id": idP, "active": true } : { "_id": idP, "active": false };
            // Return pool
            const pool = await pools.findOne(query);
            if (!pool) {
                throw new Error('No pool found with that _id')
            }
            return pool
        } catch (error) {
            logger.error(`Something went wrong in getPoolByIdFilter ${error}`);
            throw error
        }
    }

    /**
     * Finds and return a pool by its code
     * @param {string} code - code of pool to find
     * @returns {pool | null} Returns either a pool or error
     */
    static async getPoolByCode(code) {
        try {
            const pool = await pools.findOne({ "code": code });
            if (!pool) {
                throw new Error('No pool found with that code')
            }
            return pool
        } catch (error) {
            logger.error(`Something went wrong in getPoolByCode ${error}`);
            throw error
        }
    }

    /**
     * Finds and return a pool by its code
     * @param {string} code - code of pool to find
     * @param {boolean} filter - Filter active or inactive pool
     * @returns {pool | null} Returns either a pool or error
     */
    static async getPoolByCodeFilter(code, filter = true) {
        let query
        try {
            // Generate query
            query = filter ? { "code": code, "active": true } : { "code": code, "active": false };
            const pool = await pools.findOne(query);
            if (!pool) {
                throw new Error('No pool found with that code')
            }
            return pool
        } catch (error) {
            logger.error(`Something went wrong in getPoolByCodeFilter ${error}`);
            throw error
        }
    }

    /**
     * Finds and returns a list of IDs of pools with shed
     * @param {string} idShed - ID of shed to filter pools
     * @returns {[ID]} Returns either a list of IDs or an error
     */
    static async getIDsOfPoolsOfShed(idShed) {
        let idS
        try {
            // Generate ObjectID from idShed
            idS = new ObjectID.createFromHexString(idShed);
            return await pools.distinct("_id", {
                "shed": idS,
                "saca": { "$exists": false },
                "death": { "$exists": false }
            })
        } catch (error) {
            logger.error(`Something went wrong in getIDsOfPoolsOfShed ${error}`);
            throw error
        }
    }

    /**
     * Finds and returns a list of IDs of pools with shed filtering state
     * active or inactive
     * @param {string} idShed - ID of shed
     * @param {boolean} filter - Filter active or inactive pools
     * @returns {[ID]} Returns a either a list of IDs or an error
     */
    static async getIDsOfPoolsInShedFilter(idShed, filter = true) {
        let idS
        try {
            // Generate ObjectID from idShed
            idS = new ObjectID.createFromHexString(idShed);
            return await pools.distinct("_id", { "shed": idS, "active": filter })
        } catch (error) {
            logger.error(`Something went wrong in getIDsOfPoolsInShedFilter ${error}`);
            throw error
        }
    }

    /**
     * Finds and return a list of pools by its type
     * @param {string} idShed - Shed of pools
     * @param {string} type - Type of pool to find
     * @param {boolean} filter - Filter active or inactive pools
     * @param {number} offset - Return pools after offset
     * @param {number} poolsPerPage - Return n pools
     * @returns {[pool] | null} Returns either a pool or error
     */
    static async getPoolsByTypePagination(
        idShed,
        type,
        filter = true,
        offset = 0,
        poolsPerPage = 20
    ) {
        let cursor, query, displayCursor
        const idS = new ObjectID.createFromHexString(idShed);
        type = type.trim().toUpperCase();
        try {
            // Generate query to filter pools
            query = filter ? { "shed": idS,"type": type, "active": true } : { "shed": idS,"type": type, "active": false };
            // Find pools
            cursor = await pools.find(query)
        } catch (error) {
            logger.error(`Something went wrong in getPoolsByTypePagination ${error}`);
            return { poolList: [], totalNumPools: 0 }
        }
        displayCursor = cursor
        // If needs to return pools paginating
        if (poolsPerPage !== -1) {
            displayCursor = cursor.limit(poolsPerPage).skip(offset);
        }
        try {
            // Convert to Array
            const poolList = await displayCursor.toArray();
            // Get total num of pools
            let totalNumPools = await pools.countDocuments(query);
            return { poolList, totalNumPools }
        } catch (error) {
            logger.error(`Something went wrong in getPoolsByTypePagination ${error}`);
            return { poolList: [], totalNumPools: 0 }
        }
    }

    /**
     * Finds and return a list of pools by its phase
     * @param {string} idShed - Shed of pools
     * @param {string} phase - Phase of pool to find
     * @param {boolean} filter - Filter active or inactive pools
     * @param {number} offset - Return pools after offset
     * @param {number} poolsPerPage - Return n pools
     * @returns {[pool] | null} Returns either a pool or error
     */
    static async getPoolsByPhasePagination(
        idShed,
        phase,
        filter = true,
        offset = 0,
        poolsPerPage = 20
    ) {
        let cursor, query, displayCursor
        const idS = new ObjectID.createFromHexString(idShed);
        phase = phase.trim().toUpperCase();
        try {
            // Generate query to filter pools
            query = filter ? { "shed": idS,"phase": phase, "active": true } : { "shed": idS,"phase": phase, "active": false };
            // Find pools
            cursor = await pools.find(query)
        } catch (error) {
            logger.error(`Something went wrong in getPoolsByPhasePagination ${error}`);
            return { poolList: [], totalNumPools: 0 }
        }
        displayCursor = cursor
        // If needs to return pools paginating
        if (poolsPerPage !== -1) {
            displayCursor = cursor.limit(poolsPerPage).skip(offset);
        }
        try {
            // Convert to Array
            const poolList = await displayCursor.toArray();
            // Get total num of pools
            let totalNumPools = await pools.countDocuments(query);
            return { poolList, totalNumPools }
        } catch (error) {
            logger.error(`Something went wrong in getPoolsByPhasePagination ${error}`);
            return { poolList: [], totalNumPools: 0 }
        }
    }

    /**
     * Finds and return a list of pools by shed
     * @param {string} shed - shed of pool to find
     * @param {boolean} filter - Filter active or inactive pools
     * @param {number} offset - Return pools after offset
     * @param {number} poolsPerPage - Return n pools
     * @returns {[pool] | error} Returns either a list of pool or error
     */
    static async getPoolsByShedPagination(
        shed,
        filter = true,
        offset = 0,
        poolsPerPage = 20
    ) {
        let cursor, displayCursor, idShed, query
        try {
            // Generate ObjectID from shed
            idShed = new ObjectID.createFromHexString(shed);
            // Generate query to filter pools
            query = filter ? { "shed": idShed, "active": true } : { "shed": idShed, "active": false };
            // Find pools
            cursor = await pools.find(query);
        } catch (error) {
            logger.error(`Something went wrong in getPoolsByShedPagination ${error}`);
            return []
        }
        displayCursor = cursor;
        // If needs pagination
        if (poolsPerPage !== -1) {
            displayCursor = cursor.limit(poolsPerPage).skip(offset);
        }
        try {
            // Cursor to Array
            return await displayCursor.toArray();
        } catch (error) {
            logger.error(`Something went wrong in getPoolsByShedPagination ${error}`);
            return []
        }
    }

    /**
     * Finds and returns total number of pools in shed
     * @param {string} shed - shed of pool to find
     * @param {boolean} filter - Filter active or inactive pools
     * @returns {number} Returns either total number pools or an error
     */
    static async getTotalNumPoolsInShed(shed, filter = true) {
        let idShed
        try {
            // Generate ObjectID from shed
            idShed = new ObjectID.createFromHexString(shed);
            // Generate query
            const query = filter ? { "shed": idShed, "active": true } : { "shed": idShed, "active": false };
            // Generate key to search in cache
            const key = filter ? shed + "_total_number_pools_active" : shed + "_total_number_pools_inactive";
            // Verify if key already in cache
            let totalNumPools = await redis.getValueOfKey(key);
            // If not consult in db an set cache
            if (!totalNumPools) {
                // Consult in db
                totalNumPools = await pools.countDocuments(query);
                // Set in cache
                await redis.setKey(key, totalNumPools);
            }
            return totalNumPools
        } catch (error) {
            logger.error(`Something went wrong in getTotalNumPoolsInShed ${error}`);
            return 0
        }
    }

    /**
     * Finds and returns all pools in collection `pools`
     * @param {boolean} filter - Filter active or inactive pools
     * @param {number} offset - Return pools after offset
     * @param {number} poolsPerPage - Return n pools
     * @returns {[pool]} Returns a list of pools
     */
    static async getAllPoolsPagination(
        filter = true,
        offset = 0,
        poolsPerPage = 20,
    ) {
        let cursor, displayCursor, query
        try {
            // Generate query to filter pools
            query = filter ? { "active": true } : { "active": false };
            // Find pools
            cursor = await pools.find(query);
        } catch (error) {
            logger.error(`Something went wrong in getAllPoolsPagination ${error}`);
            return []
        }
        displayCursor = cursor;
        // If needs to return pools paginating
        if (poolsPerPage !== -1) {
            displayCursor = cursor.limit(poolsPerPage).skip(offset);
        }
        try {
            // Convert to Array
            return await displayCursor.toArray();
        } catch (error) {
            logger.error(`Something went wrong in getAllPoolsPagination ${error}`);
            return []
        }
    }

    /**
     * Finds and returns total number of active or inactive pools
     * @param {boolean} filter - Filter active or inactive pools
     * @returns {number} Returns total of pools or an error
     */
    static async getTotalNumPools(filter = true) {
        // Generate query
        const query = filter ? { "active": true } : { "active": false };
        // Generate key to search in cache
        const key = filter ? "db_total_number_pools_active" : "db_total_number_pools_inactive";
        try {
            // Verify if key already in cache
            let totalNumPools = await redis.getValueOfKey(key);
            // If not consult in db an set cache
            if (!totalNumPools) {
                // Consult in db
                totalNumPools = await pools.countDocuments(query);
                // Set cache
                await redis.setKey(key, totalNumPools);
            }
            return totalNumPools
        } catch (error) {
            logger.error(`Something went wrong in getTotalNumPoolsInShed ${error}`);
            return 0
        }
    }
}

module.exports = PoolDAO;