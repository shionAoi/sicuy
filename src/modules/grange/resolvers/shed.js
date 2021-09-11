const ObjectID = require('mongodb').ObjectID;
const { ForbiddenError, UserInputError } = require('apollo-server-express');
const poolDAO = require('../../../models/pool.model');
const cuyDAO = require('../../../models/cuy.model');
const shedDAO = require('../../../models/shed.model');
const mobilizationDAO = require('../../../models/mobilization.model');
const redis = require('../../../utils/redis');

/**
 * Mutation resolve, Adds a shed in collection
 * @argument {ShedInput} shed - Object input
 * @returns {shed} Returns added shed
 */
const addShed = async (_, { shed }) => {
    try {
        // Assign _id to shed
        shed["_id"] = new ObjectID();
        // Add shed
        await shedDAO.addShed(shed);
        // Get added shed
        return await shedDAO.getShedById(shed["_id"].toHexString())
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Updates a shed by its ID
 * @argument {string} idShed - ID of shed
 * @argument {update} update - Object with fields to update
 * @returns {shed} Returns either a success or an error
 */
const updateShed = async (_, { idShed, update }) => {
    try {
        // Validate idShed
        if (!ObjectID.isValid(idShed)) {
            throw new UserInputError('Invalid idShed')
        }
        // Update shed
        await shedDAO.updateShed(idShed, update);
        // Get updated shed
        return await shedDAO.getShedById(idShed)
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Deletes a shed by its ID
 * @argument {string} idShed - ID of shed
 * @returns {boolean} Returns either a success or an error
 */
const deleteShed = async (_, { idShed }) => {
    try {
        // Validate idShed
        if (!ObjectID.isValid(idShed)) {
            throw new UserInputError('Invalid idShed')
        }
        // Verify if shed is active
        let active = await redis.getValueOfKey(idShed + "_active");
        // If not in cache
        if (!active) {
            active = await (await shedDAO.getShedById(idShed)).active.toString();
            // Set cache
            await redis.setKey(idShed + "_active", active);
        }
        // Verify if shed is active
        if (active === "true") {
            throw new ForbiddenError('Forbidden Could not delete active shed')
        } else {
            // Delete shed
            await shedDAO.deleteShed(idShed);
            // Get IDs of pools in shed
            const listPools = await poolDAO.getIDsOfPoolsOfShed(idShed);
            // Delete pools of shed
            await poolDAO.deletePoolsOfShed(idShed);
            // Get all IDs of cuys in shed
            const listCuys = await cuyDAO.getIDsOfCuysOfListPools(listPools);
            // Delete all cuys in shed
            await cuyDAO.deleteCuysOfPools(listPools);
            const { success } = await mobilizationDAO.deleteMobilizationsOfCuys(listCuys);
            return success
        }
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Deactivates a shed by its ID
 * @argument {string} idShed - ID of shed
 * @returns {boolean} Returns either a success or an error
 */
const deactivateShed = async (_, { idShed }) => {
    try {
        // Validate idShed
        if (!ObjectID.isValid(idShed)) {
            throw new UserInputError('Invalid idShed')
        }
        // Verify if shed is already inactive
        let active = await redis.getValueOfKey(idShed + "_active");
        // If not in cache
        if (!active) {
            active = await (await shedDAO.getShedById(idShed)).active.toString();
            // Set cache
            await redis.setKey(idShed + "_active", active);
        }
        if (active === "false") {
            throw new ForbiddenError('Shed is already inactive')
        } else {
            // Deactivate shed
            await shedDAO.deactivateShed(idShed);
            // Get IDs of active pools in shed
            const listActivePools = await poolDAO.getIDsOfPoolsInShedFilter(idShed);
            const listAllPools = await poolDAO.getIDsOfPoolsOfShed(idShed);
            // Deactivate pools of shed
            await poolDAO.deactivatePoolsOfShed(idShed);
            // Deactivate cuys of pools
            let idPool
            for (const pool of listActivePools) {
                idPool = pool.toHexString();
                // Deactivate cuys of pool
                await cuyDAO.deactivateCuysOfPool(idPool);
                // Get new population of pool with all cuys
                const { total_population, population } = await cuyDAO.getTotalPopulationInPool(idPool);
                // update population of pool
                await poolDAO.updateTotalPopulationOfPool(idPool, total_population, population);
            }
            // Get total population of shed
            const { male, female, children } = await cuyDAO.getAllGenresOfCuysInShed(listAllPools);
            // Replace population of shed
            const { success } = await shedDAO.updateShed(idShed, {
                "male_number_cuys": male,
                "female_number_cuys": female,
                "children_number_cuys": children,
                "total_number_cuys": male + female + children
            });
            return success
        }
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Activates a shed by its ID
 * @argument {string} idShed - ID of shed
 * @returns {boolean} Returns either a success or an error
 */
const activateShed = async (_, { idShed }) => {
    try {
        // Validate idShed
        if (!ObjectID.isValid(idShed)) {
            throw new UserInputError('Invalid idShed')
        }
        // Verify if shed is already active
        let active = await redis.getValueOfKey(idShed + "_active");
        // If not in cache
        if (!active) {
            active = await (await shedDAO.getShedById(idShed)).active.toString();
            // Set cache
            await redis.setKey(idShed + "_active", active);
        }
        if (active === "true") {
            throw new ForbiddenError('Shed is already active')
        } else {
            // Activate shed
            const { success } = await shedDAO.activateShed(idShed);
            return success
        }
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve, Finds and returns a shed by its ID
 * @argument {string} idShed - ID of shed
 * @returns {shed} Returns the shed
 */
const getShedByID = async (_, { idShed }, { user }) => {
    try {
        // Validate idShed
        if (!ObjectID.isValid(idShed)) {
            throw new UserInputError('Invalid idShed')
        }
        if (user.accessLifeCycle.active && user.accessLifeCycle.inactive) {
            return await shedDAO.getShedById(idShed)
        } else if (user.accessLifeCycle.active) {
            return await shedDAO.getShedByIdFilter(idShed)
        } else if (user.accessLifeCycle.inactive) {
            return await shedDAO.getShedByIdFilter(idShed, false)
        } else {
            throw new ForbiddenError('Cant access shed not allowed')
        }
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve, Returns skip and limit to getAllSheds
 * and getTotalNumberActiveSheds
 * @argument {number} skip - Number of sheds to skip
 * @argument {number} limit - Number of sheds per page
 * @argument {boolean} filter - Filter active or inactive sheds
 * @returns {skip, limit, filter} Returns args to parents
 */
const sheds = async (_, { skip, limit, filter }, { user }) => {
    try {
        if (filter === true) {
            if (!user.accessLifeCycle.active) {
                throw new ForbiddenError('Cant access active sheds')
            }
        } else {
            if (!user.accessLifeCycle.inactive) {
                throw new ForbiddenError('Cant access inactive sheds')
            }
        }
        skip = !skip || skip < 0 ? 0 : skip;
        limit = limit || -1;
        return { skip, limit, filter }
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve parent, Finds and returns all active sheds
 * @argument {number} skip - Number of sheds to skip
 * @argument {number} limit - Number of sheds per page
 * @argument {boolean} filter - Filter active or inactive sheds
 * @returns {[shed]} Returns a list of sheds
 */
const getAllSheds = async ({ skip, limit, filter }) => {
    try {
        return await shedDAO.getAllShedsPagination(filter, skip, limit);
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve parent, Finds and returns total number of active sheds
 * @argument {boolean} filter - Filter active or inactive sheds
 * @returns {number} Returns total number of sheds
 */
const getTotalNumberSheds = async ({ filter }) => {
    try {
        return await shedDAO.getTotalNumberSheds(filter)
    } catch (error) {
        throw error
    }
}

const getShedsStatistics = async () => {
    try {
        return await shedDAO.getStatisticsTable();
    } catch (error) {
        throw error
    }
}

module.exports = {
    mutationsShed: {
        addShed,
        updateShed,
        deleteShed,
        deactivateShed,
        activateShed
    },
    queryShed: {
        getShedByID,
        sheds,
        getShedsStatistics
    },
    getAllSheds,
    getTotalNumberSheds,
}