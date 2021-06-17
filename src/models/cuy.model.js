const ObjectID = require('mongodb').ObjectID;
const config = require('../config');
const redis = require('../utils/redis');
const logger = require('../utils/winston');

/**
 * Model definition cuy in database
 * @typedef Cuy
 * @property {ID}         id
 * @property {ID}         pool
 * @property {string}     earring
 * @property {string}     race
 * @property {string}     genre - Enum: ["MACHO", "HEMBRA", "CRIA"]
 * @property {string}     current_photo
 * @property {string}     color
 * @property {string}     description
 * @property {string}     observation
 * @property {date}       created_date
 * @property {date}       updated_date
 * @property {date}       birthday_date
 * @property {boolean}    active
 * @property {float}      current_weight
 * @property {[Weight]}   weights
 * @property {Death}      death
 * @property {Saca}       saca
 */

/**
 * Model definition cuyReport in database
 * @typedef CuysReport
 * @property {ID}       _id
 * @property {string}   earring
 * @property {string}   race
 * @property {string}   genre
 * @property {float}    current_weight
 * @property {string}   current_photo
 * @property {string}   shed_code
 * @property {string}   shed_name
 * @property {string}   pool_code
 * @property {string}   pool_phase
 * @property {date}     birthday_date
 * @property {Death}    death
 * @property {Saca}     saca
 */

/**
 * Model definition weight
 * @typedef Weight
 * @property {ID}              id
 * @property {UserReports}     user
 * @property {date}            created_date
 * @property {date}            updated_date
 * @property {float}           weight
 * @property {string}          photo
*/

/**
 * Model definition death
 * @typedef Death
 * @property {date}         date
 * @property {string}       reason
 * @property {UserReports}  certified_by
 * @property {UserReports}  user
 * @property {string}       reference_doc
*/

/**
 * Model definition saca in database
 * @typedef Saca
 * @property {UserReports}  user
 * @property {UserReports}  certified_by
 * @property {string}       reason
 * @property {string}       reference_doc
 * @property {date}         created_date
 * @property {date}         updated_date
 * @property {date}         date
*/

/**
 * Model definition UserChange
 * @typedef UserReports
 * @property {ID}      _id
 * @property {string}  names
 * @property {string}  firstName
 * @property {string}  lastName
*/

/**
 * Model definition UserChange
 * @typedef UserChange
 * @property {string}  names
 * @property {string}  firstName
 * @property {string}  lastName
*/

/**
 * Success/Error return object
 * @typedef DAOResponse
 * @property {boolean} [success] - Success
 * @property {string} [error] - Error
*/

let cuys

class CuyDAO {
    static async injectDB(conn) {
        if (cuys) {
            return
        }
        try {
            cuys = await conn.db(config.MONGO_DB_NAME).collection("cuys");
        } catch (error) {
            logger.error(`Unable to establish collection handles in cuyDAO: ${error}`);
        }
    }

    static async createIndexes() {
        try {
            await cuys.createIndex({ earring: 1 }, { unique: true });
            await cuys.createIndex({
                genre: "text",
                "death.reason": "text",
                "saca.reason": "text"
            }, { default_language: "spanish" });
            await cuys.createIndex({ "weights._id": 1 });
            await cuys.createIndex({ active: 1 });
            await cuys.createIndex({ _id: 1, active: 1 });
            await cuys.createIndex({ pool: 1, active: 1 });
        } catch (error) {
            logger.error(`Error creating indexes cuyDAO ${error}`);
        }
    }

    static async countDocuments(filter) {
        try {
            return await cuys.countDocuments(filter)
        } catch (error) {
            throw error
        }
    }

    /**
     * Adds cuy to the collection `cuys`
     * @param {cuyInfo} cuyInfo - The cuy to add
     * @returns {DAOResponse} Returns either a success or an error
     */
    static async addCuy(cuyInfo) {
        let idPool, poolAux
        try {
            // Generate new ObjectID from pool
            poolAux = cuyInfo["pool"];
            idPool = new ObjectID.createFromHexString(cuyInfo["pool"]);
            cuyInfo["pool"] = idPool;
            // Default fields
            cuyInfo["created_date"] = new Date();
            cuyInfo["active"] = true;
            cuyInfo["weights"] = [];
            cuyInfo["current_weight"] = 0;
            cuyInfo["current_photo"] = "";
            // Insert cuy in collection
            await cuys.insertOne(cuyInfo);
            // Update cache
            await redis.incKeyBy("db_total_number_cuys_active", 1);
            await redis.incKeyBy(poolAux + "_total_number_cuys_active", 1);
            await redis.setKey(cuyInfo["_id"].toHexString() + "_active", "true");
            await redis.setKey(cuyInfo["_id"].toHexString() + "_genre", cuyInfo["genre"]);
            await redis.setKey(cuyInfo["_id"].toHexString() + "_pool", poolAux);
            // Return success
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in addCuy ${error}`);
            throw error
        }
    }

    /**
     * Updates a cuy by its _id in collection `cuys`
     * @param {string} idCuy - ID of cuy to be updated
     * @param {Object} update - Object with params to update
     * @returns {DAOResponse} Returns either a "success" or an error
     */
    static async updateCuy(idCuy, update) {
        let id
        try {
            // Generate ObjectID from idCuy
            id = new ObjectID.createFromHexString(idCuy);
            // Set update
            update = update || {}
            update["updated_date"] = new Date();
            // Update cuy
            const updateResponse = await cuys.updateOne(
                { "_id": id },
                { "$set": update }
            )
            // Verify if cuy was updated
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No cuy found with that _id')
            }
            // Update genre or pool of cuy in cache
            if (update.genre) {
                await redis.setKey(idCuy + "_genre", update.genre)
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in updateCuy ${error}`);
            throw error
        }
    }

    /**
     * Updates pool of cuy and state of cuy according to state of pool
     * @param {string} idCuy - ID of cuy
     * @param {string} idPool - ID of pool
     * @param {boolean} statePool - State active or inactive of pool
     * @returns {DAOResponse} Returns either a success or an error
     */
    static async updatePoolOfCuy(idCuy, idPool, statePool) {
        let idC, idP
        try {
            // Generate idCuy
            idC = new ObjectID.createFromHexString(idCuy);
            // Generate idPool
            idP = new ObjectID.createFromHexString(idPool);
            // Generate query
            let query = { "$set": { "pool": idP } }
            // If pool is inactive
            if (!statePool) {
                query = { "$set": { "pool": idP, "active": statePool } }
            }
            // Update cuy
            const updateResponse = await cuys.updateOne(
                { "_id": idC },
                { ...query }
            )
            // Verify if cuy was updated
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No cuy found with that _id')
            }
            // Update cache
            await redis.setKey(idCuy + "_pool", idPool);
            if (!statePool) {
                await redis.setKey(idCuy + "_active", "false")
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in updatePoolOfCuy ${error}`);
            throw error
        }
    }

    /**
     * Removes cuy from collection `cuys`
     * @param {string} idCuy - ID of cuy to be deleted
     * @returns {DAOResponse} Returns either a "success" or an error
     */
    static async deleteCuy(idCuy) {
        let id
        try {
            // Generate ObjectId from idCuy
            id = new ObjectID.createFromHexString(idCuy);
            // Get pool of cuy
            let pool = await redis.getValueOfKey(idCuy + "_pool");
            if (!pool) {
                pool = await (await this.getCuyById(idCuy)).pool.toHexString();
                // Set cache
                await redis.setKey(idCuy + "_pool", pool)
            }
            // Delete cuy
            await cuys.deleteOne({ "_id": id })
            // Verify if cuy was deleted
            if (!(await this.verifyCuyExists(idCuy))) {
                // Update cache
                await redis.deleteAllKeysPrefix(idCuy);
                await redis.decKeyBy("db_total_number_cuys_inactive", 1);
                await redis.decKeyBy(pool + "_total_number_cuys_inactive", 1);
                // Return success
                return { success: true }
            } else {
                throw new Error('Deletion unsuccessful')
            }
        } catch (error) {
            logger.error(`Something went wrong in deleteCuy ${error}`);
            throw error
        }
    }

    static async verifyCuyExists(idCuy) {
        let idC
        try {
            // Generate ObjectID from idCuy
            idC = new ObjectID.createFromHexString(idCuy);
            // Return pull or error
            const cuy = await cuys.findOne({ "_id": idC });
            if (!cuy) {
                return false
            }
            return true
        } catch (error) {
            logger.error(`Something went wrong in verifyCuyExists ${error}`);
            throw error
        }
    }

    /**
     * Deletes all cuys by its pool
     * @param {string} idPool - ID of pool
     * @returns {DAOResponse} - Returns either a success or an error
     */
    static async deleteCuysOfPool(idPool) {
        let idP
        try {
            // Generate ObjectID from idPool
            idP = new ObjectID.createFromHexString(idPool);
            // Get number of cuys to delete
            const numAct = await cuys.countDocuments({ "pool": idP, "active": true });
            const numIna = await cuys.countDocuments({ "pool": idP, "active": false });
            const listCuys = await cuys.distinct("_id", { "pool": idP });
            // Delete cuys
            await cuys.deleteMany({ "pool": idP });
            // Update cache
            await redis.decKeyBy("db_total_number_cuys_active", numAct);
            await redis.decKeyBy("db_total_number_cuys_inactive", numIna);
            await redis.decKeyBy(idPool + "_total_number_cuys_active", numAct);
            await redis.decKeyBy(idPool + "_total_number_cuys_inactive", numIna);
            for (const id of listCuys) {
                await redis.deleteAllKeysPrefix(id.toHexString())
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in deleteCuysOfPool ${error}`);
            throw error
        }
    }


    /**
     * Deletes all cuys of pools
     * @param {[ID]} listPools - List of IDs of pools
     * @returns {DAOResponse} Returns either a success or an error
     */
    static async deleteCuysOfPools(listPools) {
        try {
            // Get number of cuys to delete
            const numAct = await cuys.countDocuments({ "pool": { "$in": listPools }, "active": true });
            const numIna = await cuys.countDocuments({ "pool": { "$in": listPools }, "active": false });
            // Delete cuys of pools
            await cuys.deleteMany({
                "pool": { "$in": listPools }
            })
            // Update cache
            await redis.decKeyBy("db_total_number_cuys_active", numAct);
            await redis.decKeyBy("db_total_number_cuys_inactive", numIna);
            for (const id of listPools) {
                await redis.deleteAllKeysPrefix(id.toHexString())
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in deleteCuysOfPools ${error}`);
            throw error
        }
    }

    /**
     * Updates and deactivates cuy by its _id in collection `cuys`
     * @param {string} idCuy - ID of cuy to be updated
     * @returns {DAOResponse} Returns either a "success" or an error
     */
    static async deactivateCuy(idCuy) {
        let id
        try {
            // Generate ObjectID from idPool
            id = new ObjectID.createFromHexString(idCuy);
            // Get pool from cuy
            let pool = await redis.getValueOfKey(idCuy + "_pool");
            if (!pool) {
                pool = await (await this.getCuyById(idCuy)).pool.toHexString();
                // Set cache
                await redis.setKey(idCuy + "_pool", pool)
            }
            // Update cuy
            await cuys.updateOne(
                { "_id": id },
                { "$set": { "active": false, "updated_date": new Date() } }
            )
            // Update cache
            await redis.incKeyBy("db_total_number_cuys_inactive", 1);
            await redis.decKeyBy("db_total_number_cuys_active", 1);
            await redis.incKeyBy(pool + "_total_number_cuys_inactive", 1);
            await redis.decKeyBy(pool + "_total_number_cuys_active", 1);
            await redis.setKey(idCuy + "_active", "false");
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in deactivateCuy ${error}`);
            throw error
        }
    }

    /**
     * Deactivates all cuys of Pool
     * @param {string} idPool - ID of pool
     * @returns {DAOResponse} - Returns either a success or an error
     */
    static async deactivateCuysOfPool(idPool) {
        let idP
        try {
            // Generate ObjectID from idPool
            idP = new ObjectID.createFromHexString(idPool);
            // Get number of updated documents
            const num = await cuys.countDocuments({ "pool": idP, "active": true });
            // Get IDs of Cuys to update
            const list = await cuys.distinct("_id", { "pool": idP, "active": true });
            // Update Cuys
            await cuys.updateMany(
                { "pool": idP, "active": true },
                { "$set": { "active": false, "updated_date": new Date() } },
            )
            // Update cache
            await redis.incKeyBy("db_total_number_cuys_inactive", num);
            await redis.decKeyBy("db_total_number_cuys_active", num);
            await redis.incKeyBy(idPool + "_total_number_cuys_inactive", num);
            await redis.decKeyBy(idPool + "_total_number_cuys_active", num);
            for (const id of list) {
                await redis.setKey(id.toHexString() + "_active", "false")
            }
            // Return success
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in deactivateCuysOfPool ${error}`);
            throw error
        }
    }

    /**
     * Updates and activates cuy by its _id in collection `cuys`
     * @param {string} idCuy - ID of cuy to be updated
     * @returns {DAOResponse} Returns either a "success" or an error
     */
    static async activateCuy(idCuy) {
        let id
        try {
            // Generate ObjectID from idPool
            id = new ObjectID.createFromHexString(idCuy);
            // Get pool from cuy
            const pool = await redis.getValueOfKey(idCuy + "_pool");
            // Update cuy
            await cuys.updateOne(
                { "_id": id },
                { "$set": { "active": true, "updated_date": new Date() } }
            )
            // Update cache
            await redis.incKeyBy("db_total_number_cuys_active", 1);
            await redis.decKeyBy("db_total_number_cuys_inactive", 1);
            await redis.incKeyBy(pool + "_total_number_cuys_active", 1);
            await redis.decKeyBy(pool + "_total_number_cuys_inactive", 1);
            await redis.setKey(idCuy + "_active", "true");
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in activateCuy ${error}`);
            throw error
        }
    }

    /**
     * Updates and activates all cuys of Pool that are inactive
     * @param {string} idPool - ID of Pool
     * @returns {DAOResponse} Returns either a success or an error
     */
    static async activateCuysOfPool(idPool) {
        let idP
        try {
            // Validate idPool
            if (!ObjectID.isValid(idPool)) {
                throw new Error('Error. Not valid idPool')
            }
            // Generate ObjectID from idPool
            idP = new ObjectID.createFromHexString(idPool);
            // Get number of inactive cuys of pool
            const numCuys = await cuys.countDocuments({ "pool": idP, "active": false });
            // Get IDs of cuys to update
            const list = await pools.distinct("_id", { "pool": idP, "active": false });
            // Update Cuys
            await cuys.updateMany(
                { "pool": idP, "active": false },
                { "$set": { "active": true, "updated_date": new Date() } }
            )
            // Update cache
            await redis.incKeyBy("db_total_number_cuys_active", numCuys);
            await redis.decKeyBy("db_total_number_cuys_inactive", numCuys);
            await redis.incKeyBy(idPool + "_total_number_cuys_active", numCuys);
            await redis.decKeyBy(idPool + "_total_number_cuys_inactive", numCuys);
            for (const id of list) {
                await redis.setKey(id.toHexString() + "_active", "true")
            }
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in activateListOfCuys ${error}`);
            throw error
        }
    }

    /**
     * Adds weight to one cuy
     * @param {string} idCuy - ID of cuy
     * @param {Weight} weight - Weight to add
     * @returns {DAOResponse} Returns either a "success" or an error 
     */
    static async addWeightToCuy(idCuy, weight) {
        let idC
        try {
            // Generate ObjectID from idCuy
            idC = new ObjectID.createFromHexString(idCuy);
            weight["created_date"] = new Date();
            // Update cuy
            const updateResponse = await cuys.updateOne(
                { "_id": idC },
                {
                    "$push": { "weights": weight },
                    "$set": {
                        "current_weight": weight["weight"],
                        "current_photo": weight["photo"]
                    }
                }
            )
            // Verify id weight was added
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No cuy found')
            }
            // Set cache
            await redis.setKey(idCuy + "_last_weight", weight["_id"].toHexString());
            // Return success
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in addWeightToCuy ${error}`);
            throw error
        }
    }

    /**
     * Finds and returns last weight of cuy
     * @param {string} idCuy - ID of cuy
     * @returns {weight} Returns either the last weight or error
     */
    static async getLastWeightCuy(idCuy) {
        let idC
        try {
            // Generate ObjectID from idCuy
            idC = new ObjectID.createFromHexString(idCuy);
            const cuyObt = await (await cuys.aggregate([
                {
                    "$match": { "_id": idC }
                },
                {
                    "$project": {
                        "_id": 0,
                        "lastWeight": { "$arrayElemAt": ["$weights", -1] }
                    }
                }
            ])).next();
            const { lastWeight } = cuyObt;
            return lastWeight
        } catch (error) {
            logger.error(`Something went wrong in getLastWeightCuy ${error}`);
            throw error
        }
    }

    /**
 * Updates weight of cuy
 * @param {string} idCuy - ID of cuy
 * @param {string} idWeight - ID of weight
 * @param {Weight} update - Object with updates
 * @returns {DAOResponse} Returns either a "success" or an error
 */
    static async updateWeightOfCuy(idCuy, idWeight, update) {
        let idC, idW
        try {
            // Generate ObjectID
            idC = new ObjectID.createFromHexString(idCuy);
            idW = new ObjectID.createFromHexString(idWeight);
            // Generate update for nested object in weights
            update["updated_date"] = new Date();
            let newUpdate = {}
            for (const key in update) {
                newUpdate["weights.$." + key] = update[key]
            }
            // Update weight of cuy
            const updateResponse = await cuys.updateOne(
                { "_id": idC, "weights._id": idW },
                { "$set": newUpdate }
            )
            // Verify update
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No cuy found')
            }
            // Get ID of last weight in cuy
            let idLastWeight = await redis.getValueOfKey(idCuy + "_last_weight")
            if (!idLastWeight) {
                // Get last weight of cuy in db
                idLastWeight = await (await this.getLastWeightCuy(idCuy))._id.toHexString();
                // Set cache
                await redis.setKey(idCuy + "_last_weight", idLastWeight)
            }
            // If last weight of cuy updated, update cuy current weight and photo
            if (idWeight === idLastWeight) {
                let newUpd = {};
                if (update["weight"]) {
                    newUpd["current_weight"] = update["weight"]
                }
                if (update["photo"]) {
                    newUpd["current_photo"] = update["photo"]
                }
                if (Object.entries(newUpd).length !== 0) {
                    await this.updateCuy(idCuy, newUpd);
                }
            }
            // Return success
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in updateWeightOfCuy ${error}`);
            throw error
        }
    }

    /**
     * Removes weight of cuy
     * @param {string} idCuy - ID of cuy
     * @param {string} idWeight - ID of weight
     * @returns {DAOResponse} Returns either a "success" or an error 
     */
    static async removeWeightOfCuy(idCuy, idWeight) {
        let idC, idW
        try {
            // Generate ObjectID
            idC = new ObjectID.createFromHexString(idCuy);
            idW = new ObjectID.createFromHexString(idWeight);
            // Get ID of last weight in cuy
            let idLastWeight = await redis.getValueOfKey(idCuy + "_last_weight")
            if (!idLastWeight) {
                // Get last weight of cuy in db
                idLastWeight = await (await this.getLastWeightCuy(idCuy))._id.toHexString();
                // Set cache
                await redis.setKey(idCuy + "_last_weight", idLastWeight)
            }
            // Remove weight from weights in cuy
            const updateResponse = await cuys.updateOne(
                { "_id": idC },
                { "$pull": { "weights": { "_id": idW } } }
            )
            // Verify update
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No cuy found')
            }
            // If lastWeight was deleted
            if (idWeight === idLastWeight) {
                // Update current_weight and current_photo
                const lastWeight = await this.getLastWeightCuy(idCuy);
                await this.updateCuy(idCuy, {
                    "current_weight": lastWeight.weight,
                    "current_photo": lastWeight.photo
                });
                // Set cache
                await redis.setKey(idCuy + "_last_weight", idWeight)
            }
            // Return success
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in removeWeightOfCuy ${error}`);
            throw error
        }
    }

    /**
     * Updates death of cuy
     * @param {string} idCuy - ID of cuy to update
     * @param {Death} death - Object that represent death
     * @returns {DAOResponse} Returns either a "success" or an error
     */
    static async registerDeathCuy(idCuy, death) {
        let id
        try {
            // Generate ObjectID from idCuy
            id = new ObjectID.createFromHexString(idCuy);
            // Generate update for death
            let newUpdate = {}
            for (const key in death) {
                newUpdate["death." + key] = death[key]
            }
            // Verify if death exists
            const deathCuy = await (await this.getCuyById(idCuy)).death;
            if (!deathCuy) {
                newUpdate["death.created_date"] = new Date();
            } else {
                newUpdate["death.updated_date"] = new Date();
            }
            // Update cuy
            const updateResponse = await cuys.updateOne(
                { "_id": id },
                { "$set": { ...newUpdate } }
            )
            // Verify update
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No cuy found with that _id')
            }
            // Return success
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in registerDeathCuy ${error}`);
            throw error
        }
    }

    /**
     * Delete death of cuy
     * @param {string} idCuy - ID of cuy
     * @returns {DAOResponse} Returns either a "success" or an error
     */
    static async deleteDeathCuy(idCuy) {
        let id
        try {
            // Generate ObjectID from idCuy
            id = new ObjectID.createFromHexString(idCuy);
            // Unset death of cuy
            const updateResponse = await cuys.updateOne(
                { "_id": id },
                { "$unset": { "death": "" } }
            )
            // Verify if cuy is dead
            if (updateResponse.modifiedCount === 0) {
                throw new Error('Cuy is not dead')
            }
            // Verify update
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No cuy found with that _id')
            }
            // Return success
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in deleteDeathCuy ${error}`);
            throw error
        }
    }

    /**
     * Updates saca of cuy
     * @param {string} idCuy - ID of cuy
     * @param {saca} saca - Object input of saca
     * @returns {DAOResponse} Returns either a success or an error
     */
    static async registerSacaCuy(idCuy, saca) {
        let idC
        try {
            // Generate ObjectID from idCuy
            idC = new ObjectID.createFromHexString(idCuy);
            // Generate update for saca
            let newUpdate = {};
            for (const key in saca) {
                newUpdate["saca." + key] = saca[key];
            }
            // Verify if saca exists
            const sacaCuy = await (await this.getCuyById(idCuy)).saca;
            if (!sacaCuy) {
                newUpdate["saca.created_date"] = new Date();
            } else {
                newUpdate["saca.updated_date"] = new Date();
            }
            // Update cuy
            const updateResponse = await cuys.updateOne(
                { "_id": idC },
                { "$set": { ...newUpdate } }
            )
            // Verify update
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No cuy found with that _id')
            }
            // Return success
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in registerSacaCuy ${error}`);
            throw error
        }
    }

    /**
     * Remove saca of Cuy
     * @param {string} idCuy - ID of cuy
     * @returns {DAOResponse} Returns either a success or an error
     */
    static async deleteSacaCuy(idCuy) {
        let idC
        try {
            // Generate ObjectID from idCuy
            idC = new ObjectID.createFromHexString(idCuy);
            // Unset death of cuy
            const updateResponse = await cuys.updateOne(
                { "_id": idC },
                { "$unset": { "saca": "" } }
            )
            // Verify if cuy is in saca
            if (updateResponse.modifiedCount === 0) {
                throw new Error('Cuy is not in saca')
            }
            // Verify update
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No cuy found with that _id')
            }
            // Return success
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in updateDeathCuy ${error}`);
            throw error
        }
    }

    /**
     * Verify death or saca of cuy
     * @param {string} idCuy - ID of cuy
     * @returns {DAOResponse} Returns either true or error
     */
    static async verifyDeathOrSacaCuy(idCuy) {
        try {
            const cuyObject = await this.getCuyById(idCuy);
            return cuyObject.saca || cuyObject.death ? true : false
        } catch (error) {
            logger.error(`Something went wrong in verifyDeathOrSacaCuy ${error}`);
            throw error
        }
    }

    /**
     * Updates user fields in cuy when a user change their name
     * @param {string} idUser - ID of user that was updated
     * @param {UserChange} update - Fields that was changed of user
     * @returns {DAOResponse} Returns either a success or an error
     */
    static async updateUserInCuysCollection(idUser, update) {
        let idU
        try {
            // Validate idUser
            if (!ObjectID.isValid(idUser)) {
                throw new Error('Error. Invalid idUser')
            }
            // Validate update
            if (Object.entries(update).length === 0) {
                throw new Error('Error. Invalid update of user, nothing to update')
            }
            // Generate ObjectID from idUser
            idU = new ObjectID.createFromHexString(idUser);
            // Bulk for updates in cuy
            let bulkWeight = {};
            let bulkDeathUser = {};
            let bulkDeathCertified = {};
            let bulkSacaUser = {};
            let bulkSacaCertified = {};
            for (const key in update) {
                // Update for weight
                bulkWeight["weights.$[element].user." + key] = update[key];
                // Update for field user of death
                bulkDeathUser["death.user." + key] = update[key];
                // Update for field certified_by of death
                bulkDeathCertified["death.certified_by." + key] = update[key];
                // Update for field user of saca
                bulkSacaUser["saca.user." + key] = update[key];
                // Update for field certified_by of saca
                bulkSacaCertified["saca.certified_by." + key] = update[key];
            }
            // Bulk for weight of cuy
            const updateWeight = {
                "filter": {
                    "weights.user._id": idU,
                },
                "update": {
                    "$set": { ...bulkWeight },
                },
                "arrayFilters": [{ "element.user._id": idU }]
            }
            // Bulk for field user of death in cuy
            const updateUserDeath = {
                "filter": {
                    "$and": [
                        { "death": { "$exists": true } },
                        { "death.user._id": idU }
                    ]
                },
                "update": {
                    "$set": { ...bulkDeathUser }
                }
            }
            // Bulk for field certifies_by of death in cuy
            const updateCertifiedDeath = {
                "filter": {
                    "$and": [
                        { "death": { "$exists": true } },
                        { "death.certified_by._id": idU }
                    ]
                },
                "update": {
                    "$set": { ...bulkDeathCertified }
                }
            }
            // Bulk for field user of saca in cuy
            const updateUserSaca = {
                "filter": {
                    "$and": [
                        { "saca": { "$exists": true } },
                        { "saca.user._id": idU }
                    ]
                },
                "update": {
                    "$set": { ...bulkSacaUser }
                }
            }
            // Bulk for field certifies_by of saca in cuy
            const updateCertifiedSaca = {
                "filter": {
                    "$and": [
                        { "saca": { "$exists": true } },
                        { "saca.certified_by._id": idU }
                    ]
                },
                "update": {
                    "$set": { ...bulkSacaCertified }
                }
            }
            // Update all cuys with idUser in collection `cuys`
            await cuys.bulkWrite([
                { updateMany: { ...updateWeight } },
                { updateMany: { ...updateUserDeath } },
                { updateMany: { ...updateCertifiedDeath } },
                { updateMany: { ...updateUserSaca } },
                { updateMany: { ...updateCertifiedSaca } },
            ])
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in updateUserInCuysCollection ${error}`);
            throw error
        }
    }

    /**
     * Finds and returns a list of IDs cuys of pool
     * @param {string} idPool - ID of pool to filter cuys
     * @returns {[ID]} Return a list of IDs or an error
     */
    static async getAllIDsOfCuysInPool(idPool) {
        let idP
        try {
            // Generate ObjectID from idPool
            idP = new ObjectID.createFromHexString(idPool);
            return await cuys.distinct("_id", { "pool": idP })
        } catch (error) {
            logger.error(`Something went wrong in getAllIDsOfCuysInPool ${error}`);
            throw error
        }
    }

    /**
     * Finds and returns a list of IDs of cuys in a list of Pools
     * @param {[ID]} listPools - List of IDs of pools
     * @returns {[ID] | error} Return a list of IDs or an error
     */
    static async getIDsOfCuysOfListPools(listPools) {
        try {
            return await cuys.distinct("_id", {
                "pool": { "$in": listPools }
            })
        } catch (error) {
            logger.error(`Something went wrong in getIDsOfCuysOfListPools ${error}`);
            throw error
        }
    }

    /**
     * Get total number of male, female and children cuys in pool
     * @param {string} idPool - ID of pool
     * @returns {Object} Returns either an object with quantities or an error
     */
    static async getAllGenresOfCuysInPool(idPool) {
        let idP
        try {
            // Generate ObjectID from idPool
            idP = new ObjectID.createFromHexString(idPool);
            // Get genres in pool
            const results = await (await cuys.aggregate([
                {
                    "$match": {
                        "pool": idP,
                        "saca": { "$exists": false },
                        "death": { "$exists": false }
                    }
                },
                {
                    "$group": {
                        "_id": "$genre",
                        "quantity": { "$sum": 1 }
                    }
                },
                {
                    "$project": {
                        "_id": 0,
                        "genre": "$_id",
                        "quantity": 1
                    }
                }
            ])).toArray();
            let male, female, children;
            male = female = children = 0;
            for (const result of results) {
                if (result.genre.toUpperCase().search("MACHO") !== -1) {
                    male += result.quantity;
                } else if (result.genre.toUpperCase().search("HEMBRA") !== -1) {
                    female += result.quantity;
                } else {
                    children += result.quantity;
                }
            }
            return { male, female, children }
        } catch (error) {
            logger.error(`Something went wrong in getAllGenresOfCuysInPool ${error}`);
            throw error
        }
    }

    /**
     * Get total number of male, female and children cuys in shed
     * @param {[ID]} listPools - List of all pools in shed
     * @returns {Object} Returns either an object or an error
     */
    static async getAllGenresOfCuysInShed(listPools) {
        try {
            // Get genres in pool
            const results = await (await cuys.aggregate([
                {
                    "$match": { "pool": { "$in": listPools } }
                },
                {
                    "$group": {
                        "_id": "$genre",
                        "quantity": { "$sum": 1 }
                    }
                },
                {
                    "$project": {
                        "_id": 0,
                        "genre": "$_id",
                        "quantity": 1
                    }
                }
            ])).toArray();
            let male, female, children;
            male = female = children = 0;
            for (const result of results) {
                if (result.genre.toUpperCase().search("MACHO") !== -1) {
                    male += result.quantity;
                } else if (result.genre.toUpperCase().search("HEMBRA") !== -1) {
                    female += result.quantity;
                } else {
                    children += result.quantity;
                }
            }
            return { male, female, children }
        } catch (error) {
            logger.error(`Something went wrong in getAllGenresOfCuysInShed ${error}`);
            throw error
        }
    }

    /**
     * Get total Population of cuys in Pool
     * @param {string} idPool - ID of pool
     * @returns {[Population] | error} Returns either a list or an error
     */
    static async getTotalPopulationInPool(idPool) {
        let idP
        try {
            // Generate ObjectID from idPool
            idP = new ObjectID.createFromHexString(idPool);
            // Get total number of cuys in Pool
            const total_population = await cuys.countDocuments({
                "pool": idP,
                "saca": { "$exists": false },
                "death": { "$exists": false }
            });
            const population = await (await cuys.aggregate([
                {
                    "$match": {
                        "pool": idP,
                        "saca": { "$exists": false },
                        "death": { "$exists": false }
                    }
                },
                {
                    "$group": {
                        "_id": "$genre",
                        "quantity": { "$sum": 1 }
                    }
                },
                {
                    "$project": {
                        "_id": 0,
                        "genre": "$_id",
                        "quantity": 1
                    }
                }
            ])).toArray();
            return { total_population, population }
        } catch (error) {
            logger.error(`Something went wrong in getTotalPopulationInPool ${error}`);
            throw error
        }
    }

    /**
     * Get total Population of cuys in Pool
     * @param {string} idPool - ID of pool
     * @param {boolean} filter - Active or inactive cuys
     * @returns {[Population] | error} Returns either a list or an error
     */
    static async getTotalPopulationInPoolFilter(idPool, filter = true) {
        let idP
        try {
            // Generate ObjectID from idPool
            idP = new ObjectID.createFromHexString(idPool);
            // Generate query
            const query = filter ? { "pool": idP, "active": true } : { "pool": idP, "active": false };
            // Get total number of cuys in Pool
            const total_population = await cuys.countDocuments(query);
            const population = await (await cuys.aggregate([
                {
                    "$match": { ...query }
                },
                {
                    "$group": {
                        "_id": "$genre",
                        "quantity": { "$sum": 1 }
                    }
                },
                {
                    "$project": {
                        "_id": 0,
                        "genre": "$_id",
                        "quantity": 1
                    }
                }
            ])).toArray();
            return { total_population, population }
        } catch (error) {
            logger.error(`Something went wrong in getTotalPopulationInPoolFilter ${error}`);
            throw error
        }
    }

    /**
     * Finds and return a cuy by its _id
     * @param {string} idCuy - ID of cuy to find
     * @returns {Cuy | error} Returns either a cuy or an error
     */
    static async getCuyById(idCuy) {
        let idC
        try {
            // Generate ObjectID from idCuy
            idC = new ObjectID.createFromHexString(idCuy);
            // Return pull or error
            const cuy = await cuys.findOne({ "_id": idC });
            if (!cuy) {
                throw new Error('No cuy found with that _id')
            }
            return cuy
        } catch (error) {
            logger.error(`Something went wrong in getCuyById ${error}`);
            throw error
        }
    }

    static async getCuyByIdFilter(idCuy, filter = true) {
        let idC
        try {
            // Generate ObjectID from idCuy
            idC = new ObjectID.createFromHexString(idCuy);
            // Return pull or error
            const cuy = await cuys.findOne({ "_id": idC, "active": filter });
            if (!cuy) {
                throw new Error('No cuy found')
            }
            return cuy
        } catch (error) {
            logger.error(`Something went wrong in getCuyByIdFilter ${error}`);
            throw error
        }
    }

    /**
     * Finds and return a cuy by its earring
     * @param {string} earring - Earring of cuy to find
     * @returns {Cuy | error} Returns either a cuy or an error
     */
    static async getCuyByEarring(earring) {
        try {
            // Return pull or error
            const cuy = await cuys.findOne({ "earring": earring });
            if (!cuy) {
                throw new Error('No cuy found with that earring')
            }
            return cuy
        } catch (error) {
            logger.error(`Something went wrong in getCuyByEarring ${error}`);
            throw error
        }
    }

    static async getCuyByEarringFilter(earring, filter = true) {
        try {
            // Return pull or error
            const cuy = await cuys.findOne({ "earring": earring, "active": filter });
            if (!cuy) {
                throw new Error('No cuy found with that earring')
            }
            return cuy
        } catch (error) {
            logger.error(`Something went wrong in getCuyByEarringFilter ${error}`);
            throw error
        }
    }

    /**
     * Finds and returns a list of cuy by its race or genre
     * @param {Object} filterQuery - Filter for cuys by its race or genre i.e {race: Inty}
     * @param {boolean} filterActive - Filter active or inactive cuys
     * @param {number} offset - Return pools after offset
     * @param {number} poolsPerPage - Return n pools
     * @returns {[cuys]} Returns either a cuy or an error
     */
    static async getCuysByFilterPagination(
        filterQuery,
        filterActive = true,
        offset = 0,
        cuysPerPage = 20
    ) {
        let cursor, displayCursor
        try {
            // Validate filterQuery
            let numObs = Object.entries(filterQuery).length;
            if (numObs === 0 || (filterQuery["race"] === undefined && filterQuery["genre"] === undefined)) {
                throw new Error('Error. Invalid filter')
            }
            // Generate query
            filterQuery = filterQuery || {};
            filterQuery["active"] = false;
            if (filterActive) {
                filterQuery["active"] = true;
            }
            // Find cuys
            cursor = await cuys.find(filterQuery);
        } catch (error) {
            logger.error(`Something went wrong in getCuysByFilterPagination ${error}`);
            return []
        }
        displayCursor = cursor;
        // If needs to return cuys pagination
        if (cuysPerPage !== -1) {
            displayCursor = cursor.limit(cuysPerPage).skip(offset);
        }
        try {
            // Convert to Array
            return await displayCursor.toArray();
        } catch (error) {
            logger.error(`Something went wrong in getCuysByFilterPagination ${error}`);
            return []
        }
    }

    /**
     * Finds and returns a total number of cuys by its race or genre
     * @param {Object} filterQuery - Filter for cuys by its race or genre i.e {race: Inty}
     * @param {boolean} filterActive - Filter active or inactive cuys
     * @returns {number} Returns either a cuy or an error
     */
    static async getTotalNumCuysByFilter(
        filterQuery,
        filterActive = true,
    ) {
        try {
            // Validate filterQuery
            let numObs = Object.entries(filterQuery).length;
            if (numObs === 0 || (filterQuery["race"] === undefined && filterQuery["genre"] === undefined)) {
                throw new Error('Error. Invalid filter')
            }
            // Generate query
            filterQuery = filterQuery || {};
            filterQuery["active"] = false;
            if (filterActive) {
                filterQuery["active"] = true;
            }
            // Get total num of cuys
            return await cuys.countDocuments(filterQuery);
        } catch (error) {
            logger.error(`Something went wrong in getTotalNumCuysByFilter ${error}`);
            throw error
        }
    }

    /**
     * Finds and returns a list of cuys by its pool
     * @param {string} pool - pool to filter cuys
     * @param {boolean} filter - Filter active or inactive cuys
     * @param {number} offset - Return cuys after offset
     * @param {number} cuysPerPage - Return n cuys
     * @returns {[cuy] | error} Returns either a list of cuys or error
     */
    static async getCuysOfPoolPagination(
        pool,
        filter = true,
        offset = 0,
        cuysPerPage = 20
    ) {
        let cursor, displayCursor, idPool, query
        try {
            // Generate ObjectID from pool
            idPool = new ObjectID.createFromHexString(pool);
            // Generate query to filter cuys
            query = filter ? { "pool": idPool, "active": true } : { "pool": idPool, "active": false };
            // Find cuys
            cursor = await cuys.find(query);
        } catch (error) {
            logger.error(`Something went wrong in getCuysOfPoolPagination ${error}`);
            return []
        }
        displayCursor = cursor;
        // If needs pagination
        if (cuysPerPage !== -1) {
            displayCursor = cursor.limit(cuysPerPage).skip(offset);
        }
        try {
            return await displayCursor.toArray()
        } catch (error) {
            logger.error(`Something went wrong in getCuysOfPoolPagination ${error}`);
            return []
        }
    }

    /**
     * Finds and returns total number of cuys by its pool
     * @param {string} pool - pool to filter cuys
     * @param {boolean} filter - Filter active or inactive cuys
     * @returns {number} Returns either a number of cuys or error
     */
    static async getTotalNumCuysOfPool(
        pool,
        filter = true
    ) {
        let idPool
        try {
            // Validate pool
            if (!ObjectID.isValid(pool)) {
                throw new Error('Error. Invalid id of Pool')
            }
            // Generate ObjectID from pool
            idPool = new ObjectID.createFromHexString(pool);
            // Generate query to filter cuys
            const query = filter ? { "pool": idPool, "active": true } : { "pool": idPool, "active": false };
            // Generate key to search in cache
            const key = filter ? pool + "_total_number_cuys_active" : pool + "_total_number_cuys_inactive";
            // Verify if key already in cache
            let totalNumCuys = await redis.getValueOfKey(key);
            if (!totalNumCuys) {
                // Consult in db
                totalNumCuys = await cuys.countDocuments(query);
                // Set in cache
                await redis.setKey(key, totalNumCuys);
            }
            return totalNumCuys
        } catch (error) {
            logger.error(`Something went wrong in getCuysOfPoolPagination ${error}`);
            return 0
        }
    }

    /**
     * Finds and returns all cuys in collection `cuys`
     * @param {boolean} filter - Filter active or inactive pools
     * @param {number} offset - Return pools after offset
     * @param {number} poolsPerPage - Return n pools
     * @returns {[cuy] | error} Returns either a list of cuys or an error
     */
    static async getAllCuysPagination(
        filter = true,
        offset = 0,
        cuysPerPage = 20,
    ) {
        let cursor, displayCursor, query
        try {
            // Generate query to filter cuys
            query = filter ? { "active": true } : { "active": false };
            // Find cuys
            cursor = cuys.find(query)
        } catch (error) {
            logger.error(`Something went wrong in getAllCuysPagination ${error}`);
            return []
        }
        displayCursor = cursor;
        if (cuysPerPage !== -1) {
            displayCursor = cursor.limit(cuysPerPage).skip(offset);
        }
        try {
            return await displayCursor.toArray()
        } catch (error) {
            logger.error(`Something went wrong in getAllCuysPagination ${error}`);
            return []
        }
    }

    /**
     * Finds and returns total number of cuys (active or inactive) in collection `cuys`
     * @param {boolean} filter - Filter active or inactive cuys
     * @returns {number | error} Returns either number or an error
     */
    static async getTotalNumCuys(
        filter = true
    ) {
        // Generate query
        const query = filter ? { "active": true } : { "active": false };
        // Generate key to search in cache
        const key = filter ? "db_total_number_cuys_active" : "db_total_number_cuys_inactive";
        try {
            // Verify if key already in cache
            let totalNumCuys = await redis.getValueOfKey(key);
            if (!totalNumCuys) {
                // Consult in db
                totalNumCuys = await cuys.countDocuments(query);
                // Set cache
                await redis.setKey(key, totalNumCuys);
            }
            return totalNumCuys
        } catch (error) {
            logger.error(`Something went wrong in getTotalNumCuys ${error}`);
            return 0
        }
    }

    /**
     * Finds and returns all cuys in saca or death
     * @param {string} state - State to filter death or saca 
     * @param {string} idShed - ID of shed to filter cuys
     * @param {string} idPool - ID of pool to filter cuys
     * @param {string} reason - Reason of saca to filter cuys
     * @param {date} gte - Date start to filter cuys
     * @param {date} lte - Date end to filter cuys
     * @param {number} offset - Return cuys after offset
     * @param {number} cuysPerPage - Return n cuys
     * @returns {[CuysReport]} Return a list of cuys
     */
    static async getStateReports(
        shed,
        pool,
        reason,
        gte,
        lte,
        offset = 0,
        cuysPerPage = 20,
        state = "saca"
    ) {
        let f = {}
        switch (state) {
            case "death":
                f["death"] = { $exists: true }
                break;
            default:
                f["saca"] = { $exists: true }
                break;
        }
        let base = [
            {
                $match: { ...f }
            },
            {
                $lookup: {
                    from: "pools",
                    localField: "pool",
                    foreignField: "_id",
                    as: "pool"
                }
            },
            { $unwind: "$pool" },
            {
                $lookup: {
                    from: "sheds",
                    localField: "pool.shed",
                    foreignField: "_id",
                    as: "shed"
                }
            },
            { $unwind: "$shed" }
        ]
        try {
            let idShed, idPool, cursor
            // Filter cuys by shed
            if (shed) {
                idShed = new ObjectID.createFromHexString(shed);
                base.push({
                    $match: { "shed._id": idShed }
                });
            }
            // Filter cuys by pool
            if (pool) {
                idPool = new ObjectID.createFromHexString(pool);
                base.push({
                    $match: { "pool._id": idPool }
                });
            }
            // Filter by reason
            if (reason && reason !== "") {
                base.unshift({
                    $match: { $text: { $search: reason } }
                })
            }
            // Filter cuys between dates
            if (gte && lte) {
                let dateFilter = {}
                switch (state) {
                    case "death":
                        dateFilter["death.date"] = {
                            "$gte": gte,
                            "$lte": lte
                        };
                        break;
                    default:
                        dateFilter["saca.date"] = {
                            "$gte": gte,
                            "$lte": lte
                        };
                        break;
                }
                base.push({
                    $match: { ...dateFilter }
                });
            }
            const pipeline = [
                ...base,
                {
                    $facet: {
                        "totalNumCuys": [
                            { $group: { _id: null, count: { $sum: 1 } } },
                            { $project: { _id: 0 } }
                        ],
                        "cuyList": [
                            {
                                $project: {
                                    "earring": 1,
                                    "race": 1,
                                    "genre": 1,
                                    "current_weight": 1,
                                    "current_photo": 1,
                                    "shed_code": "$shed.code",
                                    "shed_name": "$shed.name",
                                    "pool_code": "$pool.code",
                                    "pool_phase": "$pool.phase",
                                    "birthday_date": 1,
                                    "death": 1,
                                    "saca": 1
                                }
                            },
                            { $limit: offset + cuysPerPage },
                            { $skip: offset }
                        ]
                    }
                },
                { $unwind: "$totalNumCuys" },
                {
                    $project: {
                        "totalNumCuys": "$totalNumCuys.count",
                        "cuyList": 1
                    }
                }
            ];
            cursor = await cuys.aggregate(pipeline);
            return await cursor.next()
        } catch (error) {
            logger.error(`Something went wrong in getStateReports ${error}`)
            throw error
        }
    }
}

module.exports = CuyDAO;