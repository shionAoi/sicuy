const ObjectID = require('mongodb').ObjectID;
const config = require('../config');
const redis = require('../utils/redis');
const logger = require('../utils/winston');

/**
 * Model definition mobilization in database
 * @typedef Mobilization
 * @property {ID}           _id
 * @property {ID}           cuy
 * @property {ID}           origin
 * @property {ID}           destination
 * @property {UserReports}  user
 * @property {date}         created_date
 * @property {date}         updated_date
 * @property {date}         date
 * @property {string}       reason
 * @property {string}       reference_doc
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
 * Model definition MobilizationReport
 * @typedef MobilizationReport
 * @property {ID}       _id
 * @property {boolean}  cuy_active
 * @property {string}   cuy_earring
 * @property {string}   cuy_genre
 * @property {Saca}     cuy_saca
 * @property {Death}    cuy_death
 * @property {string}   origin_code
 * @property {string}   origin_phase
 * @property {string}   destination_code
 * @property {string}   destination_phase
 * @property {date}     date
 * @property {date}     created_date
 * @property {date}     updated_date
 * @property {string}   reason
 * @property {string}   reference_doc
 * @property {User}     user
 */

/**
 * Success/Error return object
 * @typedef DAOResponse
 * @property {boolean} [success] - Success
 * @property {string} [error] - Error
*/

/**
 * Model definition UserChange
 * @typedef UserChange
 * @property {string}  names
 * @property {string}  firstName
 * @property {string}  lastName
*/

let mobilizations

class MobilizationDAO {
    static async injectDB(conn) {
        if (mobilizations) {
            return
        }
        try {
            mobilizations = await conn.db(config.MONGO_DB_NAME).collection("mobilizations");
        } catch (error) {
            logger.error(`Unable to establish collection handles in mobilizationDAO: ${error}`);
        }
    }

    static async createIndexes() {
        try {
            await mobilizations.createIndex({ cuy: 1 });
            await mobilizations.createIndex({ reason: "text" });
        } catch (error) {
            logger.error(`Error creating indexes MobilizationDAO ${error}`);
        }
    }

    /**
     * Adds mobilization to the collection `mobilizations`
     * @param {mobilization} mobilInfo - The mobilization to add
     * @returns {DAOResponse} Returns either a success or an error
     */
    static async addMobilization(mobilInfo) {
        try {
            // Default fields
            const idCuy = mobilInfo["cuy"];
            mobilInfo["cuy"] = new ObjectID.createFromHexString(mobilInfo["cuy"]);
            mobilInfo["origin"] = new ObjectID.createFromHexString(mobilInfo["origin"]);
            mobilInfo["destination"] = new ObjectID.createFromHexString(mobilInfo["destination"]);
            mobilInfo["created_date"] = new Date();
            // Insert mobilization in collection
            await mobilizations.insertOne(mobilInfo);
            // Update cache
            await redis.setKey(mobilInfo["_id"].toHexString() + "_cuy", idCuy);
            // Return success
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in addMobilization ${error}`);
            throw error
        }
    }

    /**
     * Updates a mobilization by its ID
     * @param {string} idMobilization - ID of mobilization
     * @param {Object} update - Object with params to update
     * @returns {DAOResponse} Returns either a success or an error
     */
    static async updateMobilization(idMobilization, update) {
        let idM
        try {
            // Generate ObjectID from idMobilization
            idM = new ObjectID.createFromHexString(idMobilization);
            // Set update
            update["updated_date"] = new Date();
            // Update Mobilization
            const updateResponse = await cuys.updateOne(
                { "_id": idM },
                { "$set": update }
            )
            // Verify if cuy was updated
            if (updateResponse.matchedCount === 0) {
                throw new Error('Error. No cuy found with that _id')
            }
            // Return success
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in updateMobilization ${error}`);
            throw error
        }
    }

    /**
     * Deletes all mobilizations of cuy
     * @param {string} idCuy - ID of cuy
     * @returns {DAOResponse} Returns either a success or an error
     */
    static async deleteMobilizationsOfCuy(idCuy) {
        let idC
        try {
            // Generate ObjectID from idCUy
            idC = new ObjectID.createFromHexString(idCuy);
            await mobilizations.deleteMany({ "cuy": idC })
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in deleteMobilizationsOfCuy ${error}`);
            throw error
        }
    }

    /**
     * Deletes all mobilizations of cuys
     * @param {[ID]} listCuys - List of IDs of cuys
     * @returns {DAOResponse} Returns either a success or an error
     */
    static async deleteMobilizationsOfCuys(listCuys) {
        try {
            await mobilizations.deleteMany({
                "cuy": { "$in": listCuys }
            })
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in deleteMobilizationsOfCuys ${error}`);
            throw error
        }
    }

    /**
     * Updates user fields in mobilization when a user change their name
     * @param {string} idUser - ID of user that was updated
     * @param {UserChange} update - Fields that was changed of user
     * @returns {DAOResponse} Returns either a success or an error
     */
    static async updateUserInMobilizationCollection(idUser, update) {
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
            // Update mobilizations
            let updateNames = {}
            for (const key in update) {
                updateNames["user." + key] = update[key];
            }
            await mobilizations.updateMany(
                { "user._id": idU },
                {
                    "$set": { ...updateNames }
                }
            );
            return { success: true }
        } catch (error) {
            logger.error(`Something went wrong in updateUserInMobilizationCollection ${error}`);
            throw error
        }
    }

    /**
     * Finds and returns a mobilization by ID
     * @param {string} idMobilization - ID of mobilization
     * @returns {Mobilization | error} Returns either a mobilization or an error
     */
    static async getMobilizationById(idMobilization) {
        let idM
        try {
            // Generate ObjectID from idMobilization
            idM = new ObjectID.createFromHexString(idMobilization);
            // Return Mobilization
            const mob = await mobilizations.findOne({ "_id": idM })
            if (!mob) {
                throw new Error('No mobilization with that ID')
            }
            return mob
        } catch (error) {
            logger.error(`Something went wrong in getMobilizationById ${error}`);
            throw error
        }
    }

    /**
     * Finds and returns all mobilization in collection `mobilization`
     * @param {string} idCuy - ID of cuy to filter mobilizations
     * @param {string} from - ID of pool to filter mobilization
     * @param {string} destination - ID of pool to filter mobilization
     * @param {date} gte - Date start to filter mobilizations
     * @param {date} lte - Date end to filter mobilizations
     * @param {string} reason - Reason of mobilizations
     * @param {number} filterState - Get only active or inactive mobilizations
     * @param {number} offset - Return mobilizations after offset
     * @param {number} mobilizationsPerPage - Return n mobilizations
     * @returns {[MobilizationReport]} Return list of mobilizations
     */
    static async getMobilizationsReports(
        idCuy,
        from,
        destination,
        gte,
        lte,
        reason,
        filterState = 2,
        offset = 0,
        mobilizationsPerPage = 20,
    ) {
        let filter = [];
        let base = [
            {
                $lookup: {
                    from: "cuys",
                    localField: "cuy",
                    foreignField: "_id",
                    as: "cuy"
                }
            },
            {
                $unwind: "$cuy"
            },
            {
                $lookup: {
                    from: "pools",
                    localField: "origin",
                    foreignField: "_id",
                    as: "origin"
                }
            },
            {
                $unwind: "$origin"
            },
            {
                $lookup: {
                    from: "pools",
                    localField: "destination",
                    foreignField: "_id",
                    as: "destination"
                }
            },
            {
                $unwind: "$destination"
            },
            {
                $project: {
                    "cuy_active": "$cuy.active",
                    "cuy_earring": "$cuy.earring",
                    "cuy_genre": "$cuy.genre",
                    "cuy_race": "$cuy.race",
                    "cuy_death": "$cuy.death",
                    "cuy_saca": "$cuy.saca",
                    "origin_code": "$origin.code",
                    "origin_phase": "$origin.phase",
                    "destination_code": "$destination.code",
                    "destination_phase": "$destination.phase",
                    "date": 1,
                    "reason": 1,
                    "reference_doc": 1,
                    "user": 1,
                    "created_date": 1,
                    "updated_date": 1
                }
            },
            { $limit: offset + mobilizationsPerPage },
            { $skip: offset },
            { $sort: { "_id": -1 } }
        ]
        try {
            let idC, idFrom, idDestination, cursor
            // Filter mobilizations by reason
            if (reason && reason !== "") {
                filter.push({
                    $match: {
                        $text: { $search: reason }
                    }
                })
            }
            // Filter mobilizations by cuy
            if (idCuy) {
                idC = new ObjectID.createFromHexString(idCuy);
                filter.push({
                    $match: { "cuy": idC }
                })
            }
            // Filter mobilizations by from
            if (from) {
                idFrom = new ObjectID.createFromHexString(from);
                filter.push({
                    $match: { "origin": idFrom }
                });
            }
            // Filter mobilizations by destination
            if (destination) {
                idDestination = new ObjectID.createFromHexString(destination);
                filter.push({
                    $match: { "destination": idDestination }
                });
            }
            // Filter mobilizations between dates
            if (gte && lte) {
                filter.push({
                    $match: {
                        "date": {
                            "$gte": gte,
                            "$lte": lte
                        }
                    }
                });
            }
            // Filter mobilizations by active or inactive cuys
            if (filterState === 0) {
                base.push({
                    $match: { "cuy_active": true }
                })
            } else if (filterState === 1) {
                base.push({
                    $match: { "cuy_active": false }
                })
            }
            // Prepare pipeline
            const pipeline = [
                ...filter,
                {
                    $facet: {
                        "totalNumMobilizations": [
                            { $group: { _id: null, count: { $sum: 1 } } },
                            { $project: { _id: 0 } }
                        ],
                        "mobilizationList": [
                            ...base
                        ]
                    }
                },
                { $unwind: "$totalNumMobilizations" },
                {
                    $project: {
                        "totalNumMobilizations": "$totalNumMobilizations.count",
                        "mobilizationList": 1
                    }
                }
            ];
            cursor = await mobilizations.aggregate(pipeline);
            return await cursor.next()
        } catch (error) {
            logger.error(`Something went wrong in getMobilizationsReports ${error}`);
            throw error
        }
    }
}

module.exports = MobilizationDAO;