const ObjectID = require('mongodb').ObjectID;
const { ForbiddenError, UserInputError } = require('apollo-server-express');
const poolDAO = require('../../../models/pool.model');
const cuyDAO = require('../../../models/cuy.model');
const shedDAO = require('../../../models/shed.model');
const mobilizationDAO = require('../../../models/mobilization.model');
const redis = require('../../../utils/redis');

/**
 * Mutation resolve, Adds a pool in db
 * @argument {PoolInput} pool - Object input
 * @returns {pool} Returns added pool
 */
const addPool = async (_, { pool }) => {
    try {
        // Validate if shed is valid
        if (!ObjectID.isValid(pool["shed"])) {
            throw new UserInputError('Error. Invalid id of shed')
        }
        // Verify shed active to add pool
        let active = await redis.getValueOfKey(pool["shed"] + "_active");
        if (!active) {
            active = await (await shedDAO.getShedById(pool["shed"])).active.toString();
            // Set cache
            await redis.setKey(pool["shed"] + "_active", active)
        }
        if (active === "false") {
            throw new ForbiddenError('Shed is inactive. Can not add pool to inactive shed')
        }
        // Assign _id to pool
        pool["_id"] = new ObjectID();
        // Add pool
        await poolDAO.addPool(pool);
        // Return added pool
        return await poolDAO.getPoolById(pool["_id"].toHexString())
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Updates a pool by its ID
 * @argument {string} idPool - ID of pool
 * @argument {update} update - Object with fields to update
 * @returns {pool} Returns either a success or an error
 */
const updatePool = async (_, { idPool, update }) => {
    try {
        // Validate idPool
        if (!ObjectID.isValid(idPool)) {
            throw new UserInputError('Invalid idPool')
        }
        // Update pool
        await poolDAO.updatePool(idPool, update);
        // Return added pool
        return await poolDAO.getPoolById(idPool)
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Deletes a pool by its ID
 * @argument {string} idPool - ID of pool
 * @returns {boolean} Returns either a success or an error
 */
const deletePool = async (_, { idPool }) => {
    let active, shed, poolObject, activeShed
    try {
        // Validate idPool
        if (!ObjectID.isValid(idPool)) {
            throw new UserInputError('Invalid idPool')
        }
        // Verify Cache
        active = await redis.getValueOfKey(idPool + "_active");
        if (!active) {
            poolObject = await poolDAO.getPoolById(idPool);
            active = poolObject.active.toString();
            // Set cache
            await redis.setKey(idPool + "_active", active);
        }
        // Verify if pool is active
        if (active === "true") {
            throw new ForbiddenError('Forbidden. Could not delete active pool')
        } else {
            // Get shed of pool in cache
            shed = await redis.getValueOfKey(idPool + "_shed");
            // If not in cache
            if (!shed) {
                // If poolObject is null
                if (!poolObject) {
                    poolObject = await poolDAO.getPoolById(idPool);
                }
                shed = poolObject.shed.toHexString();
                // Set cache
                await redis.setKey(idPool + "_shed", shed)
            }
            // Delete pool
            await poolDAO.deletePool(idPool);
            // Get all ID's of cuys in pool
            const listCuys = await cuyDAO.getAllIDsOfCuysInPool(idPool);
            // Get all genres of cuys in pool
            const { male, female, children } = await cuyDAO.getAllGenresOfCuysInPool(idPool);
            // Delete all cuys of pool
            await cuyDAO.deleteCuysOfPool(idPool);
            // Get state of shed in cache
            activeShed = await redis.getValueOfKey(shed + "_active");
            if (!activeShed) {
                activeShed = await (await shedDAO.getShedById(shed)).active.toString();
                // Set cache
                await redis.setKey(shed + "_active", activeShed)
            }
            if (activeShed === "false") {
                // Update population in shed
                await shedDAO.updateNumberOfPopulationInShed(shed, -male, -female, -children);
            }
            // Delete mobilizations of cuy
            const { success } = await mobilizationDAO.deleteMobilizationsOfCuys(listCuys);
            return success
        }
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Deactivates a pool by its ID
 * @argument {string} idPool - ID of pool
 * @returns {boolean} Returns either a success or an error
 */
const deactivatePool = async (_, { idPool }) => {
    let poolObject
    try {
        // Validate idPool
        if (!ObjectID.isValid(idPool)) {
            throw new UserInputError('Invalid idPool')
        }
        // Verify if pool is already inactive
        let active = await redis.getValueOfKey(idPool + "_active");
        if (!active) {
            poolObject = await poolDAO.getPoolById(idPool);
            active = poolObject.active.toString();
            // Set cache
            await redis.setKey(idPool + "_active", active);
        }
        if (active === "false") {
            throw new ForbiddenError('Pool is already inactive')
        } else {
            // Deactivate pool
            await poolDAO.deactivatePool(idPool);
            // Get active cuys of pool
            const activePopulation = await cuyDAO.getTotalPopulationInPoolFilter(idPool);
            // Deactivate cuys of pool
            await cuyDAO.deactivateCuysOfPool(idPool);
            // Get new population of pool with all cuys
            const { total_population, population } = await cuyDAO.getTotalPopulationInPool(idPool);
            // update population of pool
            await poolDAO.updateTotalPopulationOfPool(idPool, total_population, population);
            // Generate number of male, female and children of pool
            let male, female, children;
            male = female = children = 0;
            let genre
            for (const type of activePopulation.population) {
                genre = type.genre.toUpperCase();
                if (genre.search("MACHO") !== -1) {
                    male -= 1
                } else if (genre.search("HEMBRA") !== -1) {
                    female -= 1
                } else {
                    children -= 1
                }
            }
            // Get shed of pool in cache
            let shedId = await redis.getValueOfKey(idPool + "_shed");
            if (!shedId) {
                if (!poolObject) {
                    poolObject = await poolDAO.getPoolById(idPool);
                }
                shedId = poolObject.shed.toHexString();
                // Set cache
                await redis.setKey(idPool + "_shed", shedId);
            }
            // Update population in shed decreasing numbers
            const { success } = await shedDAO.updateNumberOfPopulationInShed(shedId, male, female, children);
            // Return success
            return success
        }
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Activates a pool by its ID
 * @argument {string} idPool
 * @returns {boolean} Returns either a success or an error
 */
const activatePool = async (_, { idPool }) => {
    let poolObject
    try {
        // Validate idPool
        if (!ObjectID.isValid(idPool)) {
            throw new UserInputError('Invalid idPool')
        }
        // Verify if pool is already active
        let active = await redis.getValueOfKey(idPool + "_active");
        if (!active) {
            poolObject = await poolDAO.getPoolById(idPool);
            active = await poolObject.active.toString();
            // Set cache
            await redis.setKey(idPool + "_active", active);
        }
        if (active === "true") {
            throw new ForbiddenError('Pool is already active')
        } else {
            // Get shed of pool in cache
            let shed = await redis.getValueOfKey(idPool + "_shed");
            if (!shed) {
                if (!poolObject) {
                    poolObject = await poolDAO.getPoolById(idPool);
                }
                shed = poolObject.shed.toHexString();
                // Set cache
                await redis.setKey(idPool + "_shed", shed);
            }
            // Get state of shed in cache
            let activeShed = await redis.getValueOfKey(shed + "_active");
            if (!activeShed) {
                activeShed = await (await shedDAO.getShedById(shed)).active.toString();
                // Set cache
                await redis.setKey(shed + "_active", activeShed);
            }
            if (activeShed === "false") {
                throw new ForbiddenError('Shed of pool is inactive')
            } else {
                // Activate pool
                const { success } = await poolDAO.activatePool(idPool);
                return success
            }
        }
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve, Finds and returns a pool by its ID
 * @argument {string} idPool - ID of pool
 * @returns {pool} Returns the pool
 */
const getPoolByID = async (_, { idPool }, { user }) => {
    try {
        // Validate idPool
        if (!ObjectID.isValid(idPool)) {
            throw new UserInputError('Invalid idPool')
        }
        // Return pool
        if (user.accessLifeCycle.active && user.accessLifeCycle.inactive) {
            return await poolDAO.getPoolById(idPool)
        } else if (user.accessLifeCycle.active) {
            return await poolDAO.getPoolByIdFilter(idPool)
        } else if (user.accessLifeCycle.inactive) {
            return await poolDAO.getPoolByIdFilter(idPool, false)
        } else {
            throw new ForbiddenError('Cant access pool not allowed')
        }
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve, Finds and returns a pool by its code
 * @argument {string} code - Code of pool
 * @returns {pool} Returns the pool
 */
const getPoolByCode = async (_, { code }, { user }) => {
    try {
        // Set filter of user
        if (user.accessLifeCycle.active && user.accessLifeCycle.inactive) {
            return await poolDAO.getPoolByCode(code)
        } else if (user.accessLifeCycle.active) {
            return await poolDAO.getPoolByCodeFilter(code)
        } else if (user.accessLifeCycle.inactive) {
            return await poolDAO.getPoolByCodeFilter(code, false)
        } else {
            throw new ForbiddenError('Cant access pool not allowed')
        }
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve, Finds and returns all pools by their type
 * @argument {string} idShed - Shed for filtering
 * @argument {string} type - Type for filtering
 * @argument {number} skip - Number of pools to skip
 * @argument {number} limit - Number of pools per page
 * @argument {boolean} filter - Filter active or inactive pools
 * @returns {[pool]} Returns a list of active pools
 */
const getPoolsByType = async (_, { idShed, type, skip, limit, filter }, { user }) => {
    try {
        // Validate idShed
        if (!ObjectID.isValid(idShed)) {
            throw new UserInputError('Invalid idShed')
        }
        // Verify filter
        if (filter === true) {
            if (!user.accessLifeCycle.active) {
                throw new ForbiddenError('Cant access active pools')
            }
        } else {
            if (!user.accessLifeCycle.inactive) {
                throw new ForbiddenError('Cant access inactive pools')
            }
        }
        skip = !skip || skip < 0 ? 0 : skip;
        limit = limit || -1;
        type = type.trim().toUpperCase();
        return await poolDAO.getPoolsByTypePagination(idShed, type, filter, skip, limit)
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve, Finds and returns all pools by their Phase
 * @argument {string} idShed - Shed for filtering
 * @argument {string} Phase - Phase for filtering
 * @argument {number} skip - Number of pools to skip
 * @argument {number} limit - Number of pools per page
 * @argument {boolean} filter - Filter active or inactive pools
 * @returns {[pool]} Returns a list of active pools
 */
const getPoolsByPhase = async (_, { idShed, phase, skip, limit, filter }, { user }) => {
    try {
        // Validate idShed
        if (!ObjectID.isValid(idShed)) {
            throw new UserInputError('Invalid idShed')
        }
        // Verify filter
        if (filter === true) {
            if (!user.accessLifeCycle.active) {
                throw new ForbiddenError('Cant access active pools')
            }
        } else {
            if (!user.accessLifeCycle.inactive) {
                throw new ForbiddenError('Cant access inactive pools')
            }
        }
        skip = !skip || skip < 0 ? 0 : skip;
        limit = limit || -1;
        phase = phase.trim().toUpperCase();
        return await poolDAO.getPoolsByPhasePagination(idShed, phase, filter, skip, limit)
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve parent, Returns all active or inactive pools of shed
 * @argument {number} skip - Number of pools to skip
 * @argument {number} limit - Number of pools per page
 * @argument {boolean} filter - Filter active or inactive pools
 */
const getPoolsInShed = async ({ _id }, { skip, limit, filter }, { user }) => {
    try {
        if (filter === true) {
            if (!user.accessLifeCycle.active) {
                throw new ForbiddenError('Cant access active pools')
            }
        } else {
            if (!user.accessLifeCycle.inactive) {
                throw new ForbiddenError('Cant access inactive pools')
            }
        }
        skip = !skip || skip < 0 ? 0 : skip;
        limit = limit || -1;
        return { shed: _id.toHexString(), skip, limit, filter }
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve parent, Returns a list of pools in shed
 * @argument {string} shed - ID of shed
 * @argument {number} skip - Number of pools to skip
 * @argument {number} limit - Number of pools per page
 * @argument {boolean} filter - Filter active or inactive pools
 * @returns {[pool]} Returns a list of pools
 */
const getPoolsOfShed = async ({ shed, skip, limit, filter }) => {
    try {
        return await poolDAO.getPoolsByShedPagination(shed, filter, skip, limit)
    } catch (error) {
        throw error
    }
}


/**
 * Query resolve parent, Returns total number of active or inactive pools of shed
 * @argument {string} shed - ID of shed from parent
 * @argument {boolean} filter -Filter active or inactive pools
 * @returns {number} Returns total number of pools
 */
const getTotalNumberPoolsInShed = async ({ shed, filter }) => {
    try {
        return await poolDAO.getTotalNumPoolsInShed(shed, filter)
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve, Return all pools of shed paginating
 * @argument {string} idShed - ID of shed
 * @argument {number} skip - Number of pools to skip
 * @argument {number} limit - Number of pools per page
 * @argument {boolean} filter - Filter active or inactive pools
 * @returns {[pool]} Returns a list of pools of shed
 */
const getPoolsByShed = async (_, { idShed, skip, limit, filter }, { user }) => {
    try {
        if (filter === true) {
            if (!user.accessLifeCycle.active) {
                throw new ForbiddenError('Cant access active pools')
            }
        } else {
            if (!user.accessLifeCycle.inactive) {
                throw new ForbiddenError('Cant access inactive pools')
            }
        }
        // Validate idShed
        if (!ObjectID.isValid(idShed)) {
            throw new UserInputError('Error invalid idShed')
        }
        skip = !skip || skip < 0 ? 0 : skip;
        limit = limit || -1;
        return { shed: idShed, skip, limit, filter }
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve, Returns all pools in collection
 * @argument {number} skip - Number of pools to skip
 * @argument {number} limit - Number of pools per page
 * @argument {boolean} filter - Filter active or inactive pools
 * @returns {skip, limit, filter} Returns args to parents
 */
const pools = async (_, { skip, limit, filter }, { user }) => {
    try {
        if (filter === true) {
            if (!user.accessLifeCycle.active) {
                throw new ForbiddenError('Cant access active pools')
            }
        } else {
            if (!user.accessLifeCycle.inactive) {
                throw new ForbiddenError('Cant access inactive pools')
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
 * Query resolve parent, Returns all pools in collection
 * @argument {number} skip - Number of pools to skip
 * @argument {number} limit - Number of pools per page
 * @argument {boolean} filter - Filter active or inactive pools
 * @returns {[pool]} Returns a list of pools
 */
const getAllPools = async ({ skip, limit, filter }) => {
    try {
        return await poolDAO.getAllPoolsPagination(filter, skip, limit)
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve parent, Returns total number of pools
 * @argument {boolean} filter - Filter active or inactive pools
 * @returns {number} Returns total number of pools
 */
const getTotalNumPools = async ({ filter }) => {
    try {
        return await poolDAO.getTotalNumPools(filter)
    } catch (error) {
        throw error
    }
}

module.exports = {
    mutations: {
        addPool,
        updatePool,
        deletePool,
        deactivatePool,
        activatePool
    },
    queries: {
        getPoolByID,
        getPoolByCode,
        getPoolsByType,
        getPoolsByPhase,
        getPoolsByShed,
        pools
    },
    getPoolsInShed,
    getPoolsOfShed,
    getTotalNumberPoolsInShed,
    getAllPools,
    getTotalNumPools
}