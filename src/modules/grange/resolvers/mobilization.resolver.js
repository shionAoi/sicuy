const ObjectID = require('mongodb').ObjectID;
const { ForbiddenError, UserInputError } = require('apollo-server-express');
const poolDAO = require('../../../models/pool.model');
const cuyDAO = require('../../../models/cuy.model');
const shedDAO = require('../../../models/shed.model');
const mobilizationDAO = require('../../../models/mobilization.model');
const userDAO = require('../../../models/user.model');
const redis = require('../../../utils/redis');


/**
 * Mutation resolve, Adds a mobilization in db
 * @argument {MobilizationInput} - Object input
 * @returns {mobilization} Return inserted mobilization
 */

const addMobilization = async (_, { mobilization }, { user }) => {
    let cuyObject, poolObject
    try {
        // Validate ID of cuy
        if (!ObjectID.isValid(mobilization["cuy"])) {
            throw new UserInputError('Invalid ID of cuy')
        }
        // Verify if cuy is death or in saca
        const death = await cuyDAO.verifyDeathOrSacaCuy(mobilization["cuy"]);
        if (death) {
            throw new ForbiddenError('Cuy is death or in saca. Could not mobilize')
        }
        // Validate ID of origin
        if (!ObjectID.isValid(mobilization["origin"])) {
            throw new UserInputError('Invalid ID of origin')
        }
        // Validate ID of destination
        if (!ObjectID.isValid(mobilization["destination"])) {
            throw new UserInputError('Invalid ID of destination')
        }
        // Generate ID for mobilization
        mobilization["_id"] = new ObjectID();
        // Add user
        mobilization["user"] = {
            "_id": user._id,
            "names": user.names,
            "firstName": user.firstName,
            "lastName": user.lastName
        }
        // Validate originPool
        let originPool = await redis.getValueOfKey(mobilization["cuy"] + "_pool");
        if (!originPool) {
            cuyObject = await cuyDAO.getCuyById(mobilization["cuy"]);
            originPool = cuyObject.pool.toHexString();
            // Set cache
            await redis.setKey(mobilization["cuy"] + "_pool", originPool);
        }
        if (originPool !== mobilization["origin"]) {
            throw new ForbiddenError('Invalid origin pool of Cuy')
        }
        // Get origin state of cu
        let originStateCuy = await redis.getValueOfKey(mobilization["cuy"] + "_active");
        let originGenreCuy = await redis.getValueOfKey(mobilization["cuy"] + "_genre");
        if (!originStateCuy || !originGenreCuy) {
            if (!cuyObject) {
                cuyObject = await cuyDAO.getCuyById(mobilization["cuy"])
            }
            originStateCuy = cuyObject.active.toString();
            originGenreCuy = cuyObject.genre;
            // Set cache
            await redis.setKey(mobilization["cuy"] + "_active", originStateCuy);
            await redis.setKey(mobilization["cuy"] + "_genre", originGenreCuy);
        }
        // Get state and shed of originPool
        let originStatePool = await redis.getValueOfKey(originPool + "_active");
        let originShed = await redis.getValueOfKey(originPool + "_shed");
        if (!originStatePool || !originShed) {
            poolObject = await poolDAO.getPoolById(originPool);
            originStatePool = poolObject.active.toString();
            originShed = poolObject.shed.toHexString();
            // Set cache
            await redis.setKey(originPool + "_active", originStatePool);
            await redis.setKey(originPool + "_shed", originShed);
        }
        // Get state of originShed
        let originStateShed = await redis.getValueOfKey(originShed + "_active");
        if (!originStateShed) {
            originStateShed = await (await shedDAO.getShedById(originShed)).active.toString();
            // Set cache
            await redis.setKey(originShed + "_active", originStateShed);
        }
        // Add mobilization
        const newMobilization = { ...mobilization };
        await mobilizationDAO.addMobilization(mobilization);
        // Get state of destination pool and its shed
        let destinationStatePool = await redis.getValueOfKey(newMobilization["destination"] + "_active");
        let destinationShed = await redis.getValueOfKey(newMobilization["destination"] + "_shed");
        if (!destinationStatePool || !destinationShed) {
            const poolDestination = await poolDAO.getPoolById(newMobilization["destination"]);
            destinationStatePool = poolDestination.active.toString();
            destinationShed = poolDestination.shed.toHexString();
            // Set cache
            await redis.setKey(newMobilization["destination"] + "_active", destinationStatePool);
            await redis.setKey(newMobilization["destination"] + "_shed", destinationShed);
        }
        // Update pool of cuy
        const stateBool = destinationStatePool === "true" ? true : false
        await cuyDAO.updatePoolOfCuy(newMobilization["cuy"], newMobilization["destination"], stateBool);
        // Update number of population of originPool and originShed
        if (originStateCuy === originStatePool) {
            await poolDAO.updatePopulationOfPool(originPool, originGenreCuy, -1);
            if (originStatePool === originStateShed) {
                await shedDAO.updateNumberOfCuysInShedByGenre(originShed, originGenreCuy, -1);
            }
        }
        // Get destination state of cuy
        let destinationStateCuy = await redis.getValueOfKey(newMobilization["cuy"] + "_active");
        if (!destinationStateCuy) {
            destinationStateCuy = await (await cuyDAO.getCuyById(newMobilization["cuy"])).active.toString();
            // Set cache
            await redis.setKey(newMobilization["cuy"] + "_active", destinationStateCuy);
        }
        // Get destination state of shed
        let destinationStateShed = await redis.getValueOfKey(destinationShed + "_active");
        if (!destinationStateShed) {
            destinationStateShed = await (await shedDAO.getShedById(destinationShed)).active.toString();
            // Set cache
            await redis.setKey(destinationShed + "_active", destinationStateShed);
        }
        // Update population of destination pool and shed
        if (destinationStateCuy === destinationStatePool) {
            await poolDAO.updatePopulationOfPool(newMobilization["destination"], originGenreCuy, 1);
            if (destinationStatePool === destinationStateShed) {
                await shedDAO.updateNumberOfCuysInShedByGenre(destinationShed, originGenreCuy, 1);
            }
        }
        return await mobilizationDAO.getMobilizationById(newMobilization["_id"].toHexString())
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Updates a mobilizations by its ID
 * @argument {string} idMobilization - ID of mobilization
 * @argument {update} update - Object with fields to update
 * @returns {mobilization} Returns the updated mobilization
 */
const updateMobilization = async (_, { idMobilization, update }, { user }) => {
    try {
        // Validate idMobilization
        if (!ObjectID.isValid(idMobilization)) {
            throw new UserInputError('Invalid idMobilization')
        }
        // Update user
        update["user"] = {
            "_id": user._id,
            "names": user.names,
            "firstName": user.firstName,
            "lastName": user.lastName
        }
        // Update mobilization
        await mobilizationDAO.updateMobilization(idMobilization, update);
        // Return updated mobilization
        return await mobilizationDAO.getMobilizationById(idMobilization)
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve, get all mobilization for report
 * @returns {[MobilizationReport]} Returns pagination report
 */
const getMobilizationReports = async (_, {
    idCuy,
    from,
    destination,
    dateFrom,
    dateTo,
    reason,
    skip,
    limit
}, { user }) => {
    try {
        // Get filter for access active or inactive cuys
        let filterState = 2;
        const accessActive = user.accessLifeCycle.active === true;
        const accessInactive = user.accessLifeCycle.inactive === true;
        if (accessActive && !accessInactive) {
            filterState = 0;
        } else if (!accessActive && accessInactive) {
            filterState = 1;
        }
        // Validate idCuy
        if (idCuy && !ObjectID.isValid(idCuy)) {
            throw new UserInputError('Invalid IdCuy')
        }
        // Valid from pool
        if (from && !ObjectID.isValid(from)) {
            throw new UserInputError('Invalid from pool')
        }
        // Valid destination pool
        if (destination && !ObjectID.isValid(destination)) {
            throw new UserInputError('Invalid destination pool')
        }
        return await mobilizationDAO.getMobilizationsReports(idCuy, from, destination, dateFrom, dateTo, reason, filterState, skip, limit)
    } catch (error) {
        throw error
    }
}

module.exports = {
    mutations: {
        addMobilization,
        updateMobilization
    },
    queries: {
        getMobilizationReports
    }
}