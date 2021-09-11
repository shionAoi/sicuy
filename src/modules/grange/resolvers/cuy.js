const ObjectID = require('mongodb').ObjectID;
const { ForbiddenError, UserInputError } = require('apollo-server-express');
const poolDAO = require('../../../models/pool.model');
const cuyDAO = require('../../../models/cuy.model');
const shedDAO = require('../../../models/shed.model');
const mobilizationDAO = require('../../../models/mobilization.model');
const userDAO = require('../../../models/user.model');
const redis = require('../../../utils/redis');
// const storage = require('../../../utils/storage');


/**
 * Mutation resolve, Adds a cuy in db
 * @argument {CuyInput} cuy - Object input
 * @returns {cuy} Returns added cuy
 */
const addCuy = async (_, { cuy }) => {
    let poolObject
    try {
        // Validate if pool is valid
        if (!ObjectID.isValid(cuy["pool"])) {
            throw new UserInputError('Error. Invalid id of Pool')
        }
        // Verify pool is active
        let activePool = await redis.getValueOfKey(cuy["pool"] + "_active");
        if (!activePool) {
            poolObject = await poolDAO.getPoolById(cuy["pool"]);
            activePool = poolObject.active.toString();
            // Set cache
            await redis.setKey(cuy["pool"] + "_active", activePool);
        }
        if (activePool === "false") {
            throw new ForbiddenError('Pools is inactive. Can not add cuy to inactive pool')
        }
        // Assign _id to cuy
        cuy["_id"] = new ObjectID();
        // Add cuy
        await cuyDAO.addCuy(cuy);
        // Update population of pool
        cuy["pool"] = cuy["pool"].toHexString();
        await poolDAO.updatePopulationOfPool(cuy["pool"], cuy["genre"]);
        // Get shed of pool
        let shed = await redis.getValueOfKey(cuy["pool"] + "_shed");
        if (!shed) {
            if (!poolObject) {
                poolObject = await poolDAO.getPoolById(cuy["pool"]);
            }
            shed = poolObject.shed.toHexString();
            // Set cache
            await redis.setKey(cuy["pool"] + "_shed", shed);
        }
        // Update population of shed
        await shedDAO.updateNumberOfCuysInShedByGenre(shed, cuy["genre"]);
        return await cuyDAO.getCuyById(cuy["_id"].toHexString())
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Updates a cuy by its ID
 * @argument {string} idCuy - ID of cuy
 * @argument {update} update - Object with fields to update
 * @returns {cuy} Returns the updated cuy 
 */
const updateCuy = async (_, { idCuy, update }) => {
    let cuyObject, poolObject, oldGenre
    try {
        // Validate idCuy
        if (!ObjectID.isValid(idCuy)) {
            throw new UserInputError('Invalid idCuy')
        }
        // If genre of cuy change
        if (update.genre) {
            // Get old genre of cuy
            oldGenre = await redis.getValueOfKey(idCuy + "_genre");
            if (!oldGenre) {
                cuyObject = await cuyDAO.getCuyById(idCuy);
                oldGenre = cuyObject.genre;
            }
            // Compare if genre of cuy changed
            if (oldGenre === update.genre) {
                delete update.genre;
                // Update cuy
                await cuyDAO.updateCuy(idCuy, update);
            } else {
                await cuyDAO.updateCuy(idCuy, update);
                // Get pool of cuy
                let pool = await redis.getValueOfKey(idCuy + "_pool");
                if (!pool) {
                    if (!cuyObject) {
                        cuyObject = await cuyDAO.getCuyById(idCuy);
                    }
                    pool = cuyObject.pool.toHexString();
                    // Set cache
                    await redis.setKey(idCuy + "_pool", pool);
                }
                // Get state of pool and state of cuy
                let activePool = await redis.getValueOfKey(pool + "_active");
                if (!activePool) {
                    poolObject = await poolDAO.getPoolById(pool);
                    activePool = poolObject.active.toString();
                    // Set cache
                    await redis.setKey(pool + "_active", activePool);
                }
                let activeCuy = await redis.getValueOfKey(idCuy + "_active");
                if (!activeCuy) {
                    if (!cuyObject) {
                        cuyObject = await cuyDAO.getCuyById(idCuy);
                    }
                    activeCuy = cuyObject.active.toString();
                    // Set cache
                    await redis.setKey(idCuy + "_active", activeCuy);
                }
                if (activeCuy === activePool) {
                    // Update population of pool
                    await poolDAO.updatePoolChangeGenreCuy(pool, oldGenre, update.genre);
                    // Get shed of pool
                    let shed = await redis.getValueOfKey(pool + "_shed");
                    if (!shed) {
                        if (!poolObject) {
                            poolObject = await poolDAO.getPoolById(pool);
                        }
                        shed = poolObject.shed.toHexString();
                        // Set cache
                        await redis.setKey(pool + "_shed", shed);
                    }
                    // Get state of shed
                    let activeShed = await redis.getValueOfKey(shed + "_active");
                    if (!activeShed) {
                        activeShed = await (await shedDAO.getShedById(shed)).active.toString();
                        // Set cache
                        await redis.setKey(shed + "_active", activeShed);
                    }
                    if (activePool === activeShed) {
                        // Update population shed
                        await shedDAO.updateShedChangeGenreCuy(shed, oldGenre, update.genre);
                    }
                }
            }
        } else {
            // Update cuy
            await cuyDAO.updateCuy(idCuy, update);
        }
        return await cuyDAO.getCuyById(idCuy)
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Deletes a cuy by its ID
 * @argument {string} idCuy - ID of Cuy
 * @returns {boolean} Returns either a success or an error
 */
const deleteCuy = async (_, { idCuy }) => {
    let active, cuyObject, pool, genre, poolObject
    try {
        // Validate idCuy
        if (!ObjectID.isValid(idCuy)) {
            throw new UserInputError('Invalid idCuy')
        }
        // Verify if cuy is already inactive
        active = await redis.getValueOfKey(idCuy + "_active");
        if (!active) {
            cuyObject = await cuyDAO.getCuyById(idCuy);
            active = cuyObject.active.toString();
            // Set cache
            await redis.setKey(idCuy + "_active", active);
        }
        if (active === "true") {
            throw new ForbiddenError('Forbidden cuy is active')
        } else {
            const cuyDeath = await cuyDAO.verifyDeathOrSacaCuy(idCuy);
            if (cuyDeath) {
                // Get pool of cuy in cache
                pool = await redis.getValueOfKey(idCuy + "_pool");
                if (!pool) {
                    if (!cuyObject) {
                        cuyObject = await cuyDAO.getCuyById(idCuy);
                    }
                    pool = cuyObject.pool.toHexString();
                    // Set cache
                    await redis.setKey(idCuy + "_pool", pool);
                }
                // Get genre of cuy in cache
                genre = await redis.getValueOfKey(idCuy + "_genre");
                if (!genre) {
                    if (!cuyObject) {
                        cuyObject = await cuyDAO.getCuyById(idCuy);
                    }
                    genre = cuyObject.genre;
                    // Set cache
                    await redis.setKey(idCuy + "_genre", genre);
                }
                // Delete Cuy
                await cuyDAO.deleteCuy(idCuy);
                // Get state of pool in cache
                let statePool = await redis.getValueOfKey(pool + "_active");
                if (!statePool) {
                    poolObject = await poolDAO.getPoolById(pool);
                    statePool = poolObject.active.toString();
                    // Set cache
                    await redis.setKey(pool + "active", statePool);
                }
                if (statePool === "false") {
                    // Update population of Pool
                    await poolDAO.updatePopulationOfPool(pool, genre, -1);
                    // Get shed of pool in cache
                    let shed = await redis.getValueOfKey(pool + "_shed");
                    if (!shed) {
                        if (!poolObject) {
                            poolObject = await poolDAO.getPoolById(pool)
                        }
                        shed = poolObject.shed.toHexString();
                        // Set cache
                        await redis.setKey(pool + "_shed", shed)
                    }
                    // Get state of shed in cache
                    let stateShed = await redis.getValueOfKey(shed + "_active");
                    if (!stateShed) {
                        stateShed = await shedDAO.getShedById(shed).active.toString();
                        // Set cache
                        await redis.setKey(shed + "_active", stateShed);
                    }
                    if (stateShed === "false") {
                        // Update population of cuys in shed
                        await shedDAO.updateNumberOfCuysInShedByGenre(shed, genre, -1);
                    }
                }
            }
            // Delete mobilizations of cuy
            const { success } = await mobilizationDAO.deleteMobilizationsOfCuy(idCuy);
            return success
        }
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Deactivates a cuy by its ID
 * @argument {string} idCuy - ID of cuy
 * @returns {boolean} Returns either a success or an error
 */
const deactivateCuy = async (_, { idCuy }) => {
    let cuyObject
    try {
        // Validate idCuy
        if (!ObjectID.isValid(idCuy)) {
            throw new UserInputError('Invalid idCuy')
        }
        // Verify if cuy is already inactive
        let active = await redis.getValueOfKey(idCuy + "_active");
        if (!active) {
            cuyObject = await cuyDAO.getCuyById(idCuy);
            active = cuyObject.active.toString();
            // Set cache
            await redis.setKey(idCuy + "_active", active);
        }
        if (active === "false") {
            throw new ForbiddenError('Cuy is already inactive')
        } else {
            // Deactivate cuy
            await cuyDAO.deactivateCuy(idCuy);
            // Get pool of cuy in cache
            let pool = await redis.getValueOfKey(idCuy + "_pool");
            if (!pool) {
                if (!cuyObject) {
                    cuyObject = await cuyDAO.getCuyById(idCuy);
                }
                pool = cuyObject.pool.toHexString();
                // Set cache
                await redis.setKey(idCuy + "_pool", pool);
            }
            // Get genre of cuy in cache
            let genre = await redis.getValueOfKey(idCuy + "_genre");
            if (!genre) {
                if (!cuyObject) {
                    cuyObject = await cuyDAO.getCuyById(idCuy);
                }
                genre = cuyObject.genre.toString();
                // Set cache
                await redis.setKey(idCuy + "_genre", genre);
            }
            // Update population of Pool
            await poolDAO.updatePopulationOfPool(pool, genre, -1);
            // Get shed of pool in cache
            let shed = await redis.getValueOfKey(pool + "_shed");
            if (!shed) {
                shed = await (await poolDAO.getPoolById(pool)).shed.toHexString();
                // Set cache
                await redis.setKey(pool + "_shed", shed);
            }
            // Update population of cuys in shed
            const { success } = await shedDAO.updateNumberOfCuysInShedByGenre(shed, genre, -1);
            return success
        }
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Activates a cuy by its ID
 * @argument {string} idCuy - ID of cuy
 * @returns {boolean} Returns either a success or an error
 */
const activateCuy = async (_, { idCuy }) => {
    let cuyObject, poolObject
    try {
        // Validate idCuy
        if (!ObjectID.isValid(idCuy)) {
            throw new UserInputError('Invalid idCuy')
        }
        // Verify if cuy is already inactive
        let active = await redis.getValueOfKey(idCuy + "_active");
        if (!active) {
            cuyObject = await cuyDAO.getCuyById(idCuy);
            active = cuyObject.active.toString();
            // Set cache
            await redis.setKey(idCuy + "_active", active);
        }
        if (active === "true") {
            throw new ForbiddenError('Cuy is already active')
        } else {
            // Get pool of cuy
            let pool = await redis.getValueOfKey(idCuy + "_pool");
            if (!pool) {
                if (!cuyObject) {
                    cuyObject = await cuyDAO.getCuyById(idCuy);
                }
                pool = cuyObject.pool.toHexString();
                // Set cache
                await redis.setKey(idCuy + "_pool", pool)
            }
            // Get state of pool in cache
            let activePool = await redis.getValueOfKey(pool + "_active");
            if (!activePool) {
                poolObject = await poolDAO.getPoolById(pool);
                activePool = poolObject.active.toString();
                // Set cache
                await redis.setKey(pool + "_active", activePool);
            }
            if (activePool === "false") {
                throw new ForbiddenError('Pool of cuy is inactive')
            } else {
                // Verify if cuy is in saca or death
                const lifeCuy = await cuyDAO.verifyDeathOrSacaCuy(idCuy);
                if (lifeCuy) {
                    throw new ForbiddenError('Cuy is death or not in pool (Saca)')
                } else {
                    // Activate cuy
                    await cuyDAO.activateCuy(idCuy);
                    // Get genre of cuy in cache
                    let genre = await redis.getValueOfKey(idCuy + "_genre");
                    if (!genre) {
                        if (!cuyObject) {
                            cuyObject = await cuyDAO.getCuyById(idCuy);
                        }
                        genre = cuyObject.genre.toString();
                        // Set cache
                        await redis.setKey(idCuy + "_genre", genre);
                    }
                    // Update population of pool
                    await poolDAO.updatePopulationOfPool(pool, genre);
                    // Get shed of pool
                    let shed = await redis.getValueOfKey(pool + "_shed");
                    if (!shed) {
                        if (!poolObject) {
                            poolObject = await poolDAO.getPoolById(pool);
                        }
                        shed = poolObject.shed.toHexString();
                        // Set cache
                        await redis.setKey(pool + "_shed", shed);
                    }
                    // Update population of shed
                    const { success } = await shedDAO.updateNumberOfCuysInShedByGenre(shed, genre);
                    return success
                }
            }
        }
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Adds a weight in cuy
 * @argument {string} idCuy - ID of cuy
 * @argument {Weight} weight - Weight to add
 * @returns {boolean} Returns either a success or an error
 */
const addWeightToCuy = async (_, { idCuy, weight }, { user }) => {
    try {
        // Validate idCUy
        if (!ObjectID.isValid(idCuy)) {
            throw new UserInputError('Error. Invalid ID of cuy')
        }
        // Create ObjectID for Weight
        weight["_id"] = new ObjectID();
        weight["user"] = {
            "_id": user._id,
            "names": user.names,
            "firstName": user.firstName,
            "lastName": user.lastName
        };
        // Save file upload
        // const path_photo = await storage.storePhoto(weight["photo"], idCuy);
        // Replace photo by its relative path
        // weight["photo"] = path_photo;
        // Add weight in db
        const { success } = await cuyDAO.addWeightToCuy(idCuy, weight);
        return success
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Updates a weight in weights of cuy
 * @argument {string} idCuy - ID of cuy
 * @argument {string} idWeight - ID of weight to update
 * @argument {weight} update - Fields of weight to update
 * @returns {boolean} Returns either a success or an error
 */
const updateWeightOfCuy = async (_, { idCuy, idWeight, update }, { user }) => {
    try {
        // Validate idCuy
        if (!ObjectID.isValid(idCuy)) {
            throw new UserInputError('Invalid idCuy')
        }
        // Validate idWeight
        if (!ObjectID.isValid(idWeight)) {
            throw new UserInputError('Invalid idWeight')
        }
        // Generate new user
        update["user"] = {
            "_id": user._id,
            "names": user.names,
            "firstName": user.firstName,
            "lastName": user.lastName
        }
        // if (update.photo !== undefined) {
        //     // Save file upload
        //     const path_photo = await storage.storePhoto(update["photo"], idCuy);
        //     // Replace photo by its relative path
        //     update["photo"] = path_photo;
        // }
        const { success } = await cuyDAO.updateWeightOfCuy(idCuy, idWeight, update);
        return success
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Removes a weight from cuy
 * @argument {string} idCuy - ID of cuy
 * @argument {string} idWeight - ID of weight to remove
 * @returns {boolean} Returns either a success or an error
 */
const removeWeightOfCuy = async (_, { idCuy, idWeight }) => {
    try {
        // Validate idCuy
        if (!ObjectID.isValid(idCuy)) {
            throw new UserInputError('Invalid idCuy')
        }
        // Validate idWeight
        if (!ObjectID.isValid(idWeight)) {
            throw new UserInputError('Invalid idWeight')
        }
        const { success } = await cuyDAO.removeWeightOfCuy(idCuy, idWeight);
        return success
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Register saca of cuy
 * @argument {string} idCuy - ID of cuy
 * @argument {saca} saca - Saca input of cuy
 * @returns {boolean} Returns either a success or an error
 */
const registerSacaCuy = async (_, { idCuy, saca }, { user }) => {
    let cuyObject, poolObject
    try {
        // Verify if idCuy is valid
        if (!ObjectID.isValid(idCuy)) {
            throw new UserInputError('Invalid idCuy')
        }
        // Verify certified_by is valid
        if (!ObjectID.isValid(saca["certified_by"])) {
            throw new UserInputError('Invalid certified_by')
        }
        // Verify if saca exists
        const sacaCuy = await (await cuyDAO.getCuyById(idCuy)).saca;
        if (sacaCuy) {
            throw new ForbiddenError('Saca is already registered in cuy. Might you want to update saca')
        }
        // Get user certified_by
        const userCert = await userDAO.getUserById(saca["certified_by"]);
        // Generate saca object
        saca["user"] = {
            "_id": user._id,
            "names": user.names,
            "firstName": user.firstName,
            "lastName": user.lastName
        };
        saca["certified_by"] = {
            "_id": userCert._id,
            "names": userCert.names,
            "firstName": userCert.firstName,
            "lastName": userCert.lastName
        };
        // Verify if cuy is death
        const deathCuy = await cuyDAO.verifyDeathOrSacaCuy(idCuy);
        // Register saca cuy
        // if (saca.reference_doc !== undefined) {
        //     // Store reference doc
        //     const doc_path = await storage.storeFile(saca["reference_doc"], idCuy);
        //     saca["reference_doc"] = doc_path;
        // }
        await cuyDAO.registerSacaCuy(idCuy, saca);
        // Get cache of cuy
        let active = await redis.getValueOfKey(idCuy + "_active");
        let genre = await redis.getValueOfKey(idCuy + "_genre");
        let pool = await redis.getValueOfKey(idCuy + "_pool");
        if (!active || !genre || !pool) {
            cuyObject = await cuyDAO.getCuyById(idCuy);
            active = cuyObject.active.toString();
            genre = cuyObject.genre;
            pool = cuyObject.pool.toHexString();
            // Set cache
            await redis.setKey(idCuy + "_active", active);
            await redis.setKey(idCuy + "_genre", genre);
            await redis.setKey(idCuy + "_pool", pool);
        }
        // Cuy active
        if (active === "true") {
            // Deactivate cuy
            await cuyDAO.deactivateCuy(idCuy);
            // Update population of Cuy
            await poolDAO.updatePopulationOfPool(pool, genre, -1);
            let shed = await redis.getValueOfKey(pool + "_shed");
            if (!shed) {
                shed = await (await poolDAO.getPoolById(pool)).shed.toHexString();
                // Set cache
                await redis.setKey(pool + "_shed", shed);
            }
            const { success } = await shedDAO.updateNumberOfCuysInShedByGenre(shed, genre, -1);
            return success
        } else {
            if (!deathCuy) {
                // Get state of pool in cache
                let activePool = await redis.getValueOfKey(pool + "_active");
                let shed = await redis.getValueOfKey(pool + "_shed");
                if (!activePool || !shed) {
                    poolObject = await poolDAO.getPoolById(pool);
                    activePool = poolObject.active.toString();
                    shed = poolObject.shed.toHexString();
                    // Set cache
                    await redis.setKey(pool + "_active", activePool);
                    await redis.setKey(pool + "_shed", shed);
                }
                // Pool is inactive
                if (activePool === "false") {
                    await poolDAO.updatePopulationOfPool(pool, genre, -1);
                }
                // Get state of shed in cache
                let activeShed = await redis.getValueOfKey(shed + "_active");
                if (!activeShed) {
                    activeShed = await (await shedDAO.getShedById(shed)).active.toString();
                    // Set cache
                    await redis.setKey(shed + "_active", activeShed);
                }
                // If shed inactive
                if (activeShed === "false") {
                    await shedDAO.updateNumberOfCuysInShedByGenre(shed, genre, -1);
                }
            }
            return true
        }
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Updates saca of cuy
 * @argument {string} idCuy - ID of cuy
 * @argument {saca} saca - Saca input of cuy
 * @returns {boolean} Returns either a success or an error
 */
const updateSacaCuy = async (_, { idCuy, saca }, { user }) => {
    try {
        // Verify if idCuy is valid
        if (!ObjectID.isValid(idCuy)) {
            throw new UserInputError('Invalid idCuy')
        }
        // Verify certified_by is valid
        if (saca.certified_by) {
            if (!ObjectID.isValid(saca["certified_by"])) {
                throw new UserInputError('Invalid certified_by')
            }
            // Get user certified_by
            const userCert = await userDAO.getUserById(saca["certified_by"]);
            saca["certified_by"] = {
                "_id": userCert._id,
                "names": userCert.names,
                "firstName": userCert.firstName,
                "lastName": userCert.lastName
            };
        }
        // Generate saca object
        saca["user"] = {
            "_id": user._id,
            "names": user.names,
            "firstName": user.firstName,
            "lastName": user.lastName
        };
        // Verify if saca exists
        const sacaCuy = await (await cuyDAO.getCuyById(idCuy)).saca;
        if (!sacaCuy) {
            throw new ForbiddenError('Saca was not registered in cuy')
        } else {
            // if (saca.reference_doc !== undefined) {
            //     // Store reference doc
            //     const doc_path = await storage.storeFile(saca["reference_doc"], idCuy);
            //     saca["reference_doc"] = doc_path;
            // }
            // Update saca cuy
            const { success } = await cuyDAO.registerSacaCuy(idCuy, saca);
            return success
        }
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Removes saca of cuy
 * @argument {string} idCuy - ID of cuy
 * @returns {boolean} Returns either a success or an error
 */
const removeSacaCuy = async (_, { idCuy }) => {
    let cuyObject, poolObject
    try {
        // Verify if idCuy is valid
        if (!ObjectID.isValid(idCuy)) {
            throw new UserInputError('Invalid idCuy')
        }
        // Delete saca of cuy
        await cuyDAO.deleteSacaCuy(idCuy);
        // Verify if cuy is dead
        const deadCuy = await cuyDAO.verifyDeathOrSacaCuy(idCuy);
        if (!deadCuy) {
            // Update population of pool and shed
            // Get cache of cuy
            let genre = await redis.getValueOfKey(idCuy + "_genre");
            let pool = await redis.getValueOfKey(idCuy + "_pool");
            if (!genre || !pool) {
                cuyObject = await cuyDAO.getCuyById(idCuy);
                genre = cuyObject.genre;
                pool = cuyObject.pool.toHexString();
                // Set cache
                await redis.setKey(idCuy + "_genre", genre);
                await redis.setKey(idCuy + "_pool", pool);
            }
            // Get state of pool in cache
            let activePool = await redis.getValueOfKey(pool + "_active");
            let shed = await redis.getValueOfKey(pool + "_shed");
            if (!activePool || !shed) {
                poolObject = await poolDAO.getPoolById(pool);
                activePool = poolObject.active.toString();
                shed = poolObject.shed.toHexString();
                // Set cache
                await redis.setKey(pool + "_active", activePool);
                await redis.setKey(pool + "_shed", shed);
            }
            if (activePool === "false") {
                await poolDAO.updatePopulationOfPool(pool, genre, 1);
            }
            // Get state of shed in cache
            let activeShed = await redis.getValueOfKey(shed + "_active");
            if (!activeShed) {
                activeShed = await (await shedDAO.getShedById(shed)).active.toString();
                // Set cache
                await redis.setKey(shed + "_active", activeShed);
            }
            if (activeShed === "false") {
                await shedDAO.updateNumberOfCuysInShedByGenre(shed, genre, 1);
            }
        }
        return true
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Adds a death in cuy
 * @argument {string} idCuy - ID of cuy
 * @argument {death} death - Death input object
 * @returns {boolean} Returns either a success or an error
 */
const registerDeathCuy = async (_, { idCuy, death }, { user }) => {
    let cuyObject, poolObject
    try {
        // Verify if idCuy is valid
        if (!ObjectID.isValid(idCuy)) {
            throw new UserInputError('Invalid idCuy')
        }
        // Verify certified_by is valid
        if (!ObjectID.isValid(death["certified_by"])) {
            throw new UserInputError('Invalid certified_by')
        }
        // Verify if death exists
        const deathCuy = await (await cuyDAO.getCuyById(idCuy)).death;
        if (deathCuy) {
            throw new ForbiddenError('Death is already registered in cuy. Might you want to update death')
        }
        // Get user certified_by
        const userCert = await userDAO.getUserById(death["certified_by"]);
        // Generate death object
        death["user"] = {
            "_id": user._id,
            "names": user.names,
            "firstName": user.firstName,
            "lastName": user.lastName
        };
        death["certified_by"] = {
            "_id": userCert._id,
            "names": userCert.names,
            "firstName": userCert.firstName,
            "lastName": userCert.lastName
        };
        // Verify if cuy is in saca
        const sacaCuy = await cuyDAO.verifyDeathOrSacaCuy(idCuy);
        // Register death cuy
        // if (death.reference_doc !== undefined) {
        //     // Store reference doc
        //     const doc_path = await storage.storeFile(death["reference_doc"], idCuy);
        //     death["reference_doc"] = doc_path;
        // }
        await cuyDAO.registerDeathCuy(idCuy, death);
        // Get cache of cuy
        let active = await redis.getValueOfKey(idCuy + "_active");
        let genre = await redis.getValueOfKey(idCuy + "_genre");
        let pool = await redis.getValueOfKey(idCuy + "_pool");
        if (!active || !genre || !pool) {
            cuyObject = await cuyDAO.getCuyById(idCuy);
            active = cuyObject.active.toString();
            genre = cuyObject.genre;
            pool = cuyObject.pool.toHexString();
            // Set cache
            await redis.setKey(idCuy + "_active", active);
            await redis.setKey(idCuy + "_genre", genre);
            await redis.setKey(idCuy + "_pool", pool);
        }
        // Cuy active
        if (active === "true") {
            // Deactivate cuy
            await cuyDAO.deactivateCuy(idCuy);
            // Update population of Cuy
            await poolDAO.updatePopulationOfPool(pool, genre, -1);
            let shed = await redis.getValueOfKey(pool + "_shed");
            if (!shed) {
                shed = await (await poolDAO.getPoolById(pool)).shed.toHexString();
                // Set cache
                await redis.setKey(pool + "_shed", shed);
            }
            const { success } = await shedDAO.updateNumberOfCuysInShedByGenre(shed, genre, -1);
            return success
        } else {
            if (!sacaCuy) {
                // Get state of pool in cache
                let activePool = await redis.getValueOfKey(pool + "_active");
                let shed = await redis.getValueOfKey(pool + "_shed");
                if (!activePool || !shed) {
                    poolObject = await poolDAO.getPoolById(pool);
                    activePool = poolObject.active.toString();
                    shed = poolObject.shed.toHexString();
                    // Set cache
                    await redis.setKey(pool + "_active", activePool);
                    await redis.setKey(pool + "_shed", shed);
                }
                // Pool is inactive
                if (activePool === "false") {
                    await poolDAO.updatePopulationOfPool(pool, genre, -1);
                }
                // Get state of shed in cache
                let activeShed = await redis.getValueOfKey(shed + "_active");
                if (!activeShed) {
                    activeShed = await (await shedDAO.getShedById(shed)).active.toString();
                    // Set cache
                    await redis.setKey(shed + "_active", activeShed);
                }
                // If shed inactive
                if (activeShed === "false") {
                    await shedDAO.updateNumberOfCuysInShedByGenre(shed, genre, -1);
                }
            }
            return true
        }
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Updates death of cuy
 * @argument {string} idCuy - ID of cuy
 * @argument {death} death - Death of cuy
 * @returns {boolean} Returns either a success or an error
 */
const updateDeathOfCuy = async (_, { idCuy, death }, { user }) => {
    try {
        // Verify if idCuy is valid
        if (!ObjectID.isValid(idCuy)) {
            throw new UserInputError('Invalid idCuy')
        }
        // Verify certified_by is valid
        if (death.certified_by) {
            if (!ObjectID.isValid(death["certified_by"])) {
                throw new UserInputError('Invalid certified_by')
            }
            // Get user certified_by
            const userCert = await userDAO.getUserById(death["certified_by"]);
            death["certified_by"] = {
                "_id": userCert._id,
                "names": userCert.names,
                "firstName": userCert.firstName,
                "lastName": userCert.lastName
            };
        }
        // Generate death object
        death["user"] = {
            "_id": user._id,
            "names": user.names,
            "firstName": user.firstName,
            "lastName": user.lastName
        };
        // Verify death exists
        const deathCuy = await (await cuyDAO.getCuyById(idCuy)).death;
        if (!deathCuy) {
            throw new ForbiddenError('Cuy is not dead')
        } else {
            // Update death cuy
            // if (death.reference_doc !== undefined) {
            //     // Store reference doc
            //     const doc_path = await storage.storeFile(death["reference_doc"], idCuy);
            //     death["reference_doc"] = doc_path;
            // }
            const { success } = await cuyDAO.registerDeathCuy(idCuy, death);
            return success
        }
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Removes death of cuy
 * @argument {string} idCuy - ID of cuy
 * @returns {boolean} Returns either a success or an error
 */
const removeDeathCuy = async (_, { idCuy }) => {
    let cuyObject, poolObject
    try {
        // Verify if idCuy is valid
        if (!ObjectID.isValid(idCuy)) {
            throw new UserInputError('Invalid idCuy')
        }
        // Delete death of cuy
        await cuyDAO.deleteDeathCuy(idCuy);
        // verify if cuy in saca
        const sacaCuy = await cuyDAO.verifyDeathOrSacaCuy(idCuy);
        if (!sacaCuy) {
            // Update population of pool and shed
            // Get cache of cuy
            let genre = await redis.getValueOfKey(idCuy + "_genre");
            let pool = await redis.getValueOfKey(idCuy + "_pool");
            if (!genre || !pool) {
                cuyObject = await cuyDAO.getCuyById(idCuy);
                genre = cuyObject.genre;
                pool = cuyObject.pool.toHexString();
                // Set cache
                await redis.setKey(idCuy + "_genre", genre);
                await redis.setKey(idCuy + "_pool", pool);
            }
            // Get state of pool in cache
            let activePool = await redis.getValueOfKey(pool + "_active");
            let shed = await redis.getValueOfKey(pool + "_shed");
            if (!activePool || !shed) {
                poolObject = await poolDAO.getPoolById(pool);
                activePool = poolObject.active.toString();
                shed = poolObject.shed.toHexString();
                // Set cache
                await redis.setKey(pool + "_active", activePool);
                await redis.setKey(pool + "_shed", shed);
            }
            if (activePool === "false") {
                await poolDAO.updatePopulationOfPool(pool, genre, 1);
            }
            // Get state of shed in cache
            let activeShed = await redis.getValueOfKey(shed + "_active");
            if (!activeShed) {
                activeShed = await (await shedDAO.getShedById(shed)).active.toString();
                // Set cache
                await redis.setKey(shed + "_active", activeShed);
            }
            if (activeShed === "false") {
                await shedDAO.updateNumberOfCuysInShedByGenre(shed, genre, 1);
            }
        }
        return true
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve, Finds and returns a cuy by its ID
 * @argument {string} idCuy - ID of Cuy
 * @returns {cuy} Returns either a cuy or an error
 */
const getCuyByID = async (_, { idCuy }, { user }) => {
    try {
        // Validate idCuy
        if (!ObjectID.isValid(idCuy)) {
            throw new UserInputError('Invalid idCuy')
        }
        // Return cuy
        if (user.accessLifeCycle.active && user.accessLifeCycle.inactive) {
            return await cuyDAO.getCuyById(idCuy)
        } else if (user.accessLifeCycle.active) {
            return await cuyDAO.getCuyByIdFilter(idCuy)
        } else if (user.accessLifeCycle.inactive) {
            return await cuyDAO.getCuyByIdFilter(idCuy, false)
        } else {
            throw new ForbiddenError('Cant access cuy not allowed')
        }
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve, Finds and returns a cuy by its earring
 * @argument {string} earring - Earring of cuy
 * @returns {cuy} Returns either a cuy or an error
 */
const getCuyByEarring = async (_, { earring }, { user }) => {
    try {
        if (user.accessLifeCycle.active && user.accessLifeCycle.inactive) {
            return await cuyDAO.getCuyByEarring(earring)
        } else if (user.accessLifeCycle.active) {
            return await cuyDAO.getCuyByEarringFilter(earring)
        } else if (user.accessLifeCycle.inactive) {
            return await cuyDAO.getCuyByEarringFilter(earring, false)
        } else {
            throw new ForbiddenError('Cant access cuy not allowed')
        }
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve, Returns all cuys by their race
 * @argument {string} race - Race of cuys
 * @argument {number} skip - Number of cuys to skip
 * @argument {number} limit - Number of cuys per page
 * @argument {boolean} filter - Filter active or inactive cuys
 * @returns {race,filter,skip,limit} Returns params to parents
 */
const getCuysByRace = async (_, { race, skip, limit, filter }, { user }) => {
    try {
        if (filter === true) {
            if (!user.accessLifeCycle.active) {
                throw new ForbiddenError('Cant access active cuys')
            }
        } else {
            if (!user.accessLifeCycle.inactive) {
                throw new ForbiddenError('Cant access inactive cuys')
            }
        }
        skip = !skip || skip < 0 ? 0 : skip;
        limit = limit || -1;
        const filterQuery = { "race": race };
        return { filterQuery, skip, limit, filter }
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve, Returns all cuys by their race
 * @argument {string} race - Race of cuys
 * @argument {number} skip - Number of cuys to skip
 * @argument {number} limit - Number of cuys per page
 * @argument {boolean} filter - Filter active or inactive cuys
 * @returns {race,filter,skip,limit} Returns params to parents
 */
const getCuysByGenre = async (_, { genre, skip, limit, filter }, { user }) => {
    try {
        if (filter === true) {
            if (!user.accessLifeCycle.active) {
                throw new ForbiddenError('Cant access active cuys')
            }
        } else {
            if (!user.accessLifeCycle.inactive) {
                throw new ForbiddenError('Cant access inactive cuys')
            }
        }
        skip = !skip || skip < 0 ? 0 : skip;
        limit = limit || -1;
        const filterQuery = { "genre": genre };
        return { filterQuery, skip, limit, filter }
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve parent, Returns a list of cuys by their race or genre
 * @argument {Object} filterQuery - Filter of race or genre
 * @argument {number} skip - Number of cuys to skip
 * @argument {number} limit - Number of cuys per page
 * @argument {boolean} filter - Filter active or inactive cuys
 * @returns {[cuy]} Returns a list of cuys
 */
const getCuyListByFilterQuery = async ({ filterQuery, skip, limit, filter }) => {
    try {
        return await cuyDAO.getCuysByFilterPagination(filterQuery, filter, skip, limit)
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve parent, Returns total number of cuys by filterQuery
 * @argument {Object} filterQuery - Filter of race or genre
 * @argument {boolean} filter - Filter active or inactive cuys
 * @returns {number} Returns total count of cuys
 */
const getTotalNumCuysByFilterQuery = async ({ filterQuery, filter }) => {
    try {
        return await cuyDAO.getTotalNumCuysByFilter(filterQuery, filter)
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve, Finds and returns all cuys of pool
 * @argument {string} idPool - ID of pool
 * @argument {number} skip - Number of cuys to skip
 * @argument {number} limit - Number of cuys per page
 * @argument {boolean} filter - Filter active or inactive cuys
 * @returns {idPool,skip,limit,filter} Returns params to parents
 */
const getAllCuysOfPool = async (_, { idPool, skip, limit, filter }, { user }) => {
    try {
        // Validate idPool
        if (!ObjectID.isValid(idPool)) {
            throw new UserInputError('Invalid idPool')
        }
        if (filter === true) {
            if (!user.accessLifeCycle.active) {
                throw new ForbiddenError('Cant access active cuys')
            }
        } else {
            if (!user.accessLifeCycle.inactive) {
                throw new ForbiddenError('Cant access inactive cuys')
            }
        }
        skip = !skip || skip < 0 ? 0 : skip;
        limit = limit || -1;
        return { pool: idPool, skip, limit, filter }
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve parent, Returns all cuys of pool. Used in field cuys of pool
 * @argument {number} skip - Number of cuys to skip
 * @argument {number} limit - Number of cuys per page
 * @argument {boolean} filter - Filter active or inactive cuys
 */
const getCuysInPool = async ({ _id }, { skip, limit, filter }, { user }) => {
    try {
        if (filter === true) {
            if (!user.accessLifeCycle.active) {
                throw new ForbiddenError('Cant access active cuys')
            }
        } else {
            if (!user.accessLifeCycle.inactive) {
                throw new ForbiddenError('Cant access inactive cuys')
            }
        }
        skip = !skip || skip < 0 ? 0 : skip;
        limit = limit || -1;
        return { pool: _id.toHexString(), skip, limit, filter }
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve parent, Returns a list of cuys in pool
 * @argument {string} pool - ID of pool
 * @argument {number} skip - Number of cuys to skip
 * @argument {number} limit - Number of cuys per page
 * @argument {boolean} filter - Filter active or inactive cuys
 * @returns {[cuy]} Returns a list of cuts
 */
const getCuysOfPool = async ({ pool, skip, limit, filter }) => {
    try {
        return await cuyDAO.getCuysOfPoolPagination(pool, filter, skip, limit)
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve parent, Returns total number of cuys in pool
 * @argument {string} pool - ID of pool
 * @argument {boolean} filter - Filter active or inactive cuys
 */
const getTotalNumberCuysInPool = async ({ pool, filter }) => {
    try {
        return await cuyDAO.getTotalNumCuysOfPool(pool, filter)
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve, Returns all active or inactive cuys
 * @argument {number} skip - Number of cuys to skip
 * @argument {number} limit - Number of cuys per page
 * @argument {boolean} filter - Filter active or inactive cuys
 * @returns {skip,limit,filter} Returns params to parents
 */
const cuys = async (_, { limit, skip, filter }, { user }) => {
    try {
        if (filter === true) {
            if (!user.accessLifeCycle.active) {
                throw new ForbiddenError('Cant access active cuys')
            }
        } else {
            if (!user.accessLifeCycle.inactive) {
                throw new ForbiddenError('Cant access inactive cuys')
            }
        }
        skip = !skip || skip < 0 ? 0 : skip;
        limit = limit || -1;
        return { limit, skip, filter }
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve parent, finds and returns a list of cuys
 * @argument {number} skip - Number of cuys to skip
 * @argument {number} limit - Number of cuys per page
 * @argument {boolean} filter - Filter active or inactive cuys
 * @returns {[cuy]} Returns a list of cuys
 */
const getAllCuysList = async ({ limit, skip, filter }) => {
    try {
        return await cuyDAO.getAllCuysPagination(filter, skip, limit)
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve parent, Finds and returns total number of cuys
 * @argument {boolean} filter - Filter active or inactive cuys
 * @returns {number} Returns total number of cuys
 */
const getTotalNumberCuys = async ({ filter }) => {
    try {
        return await cuyDAO.getTotalNumCuys(filter)
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve, Finds and returns all death cuys
 */
const getDeathCuysReport = async (_, {
    idShed,
    idPool,
    dateFrom,
    dateTo,
    reason,
    skip,
    limit
}) => {
    try {
        // Valid shed
        if (idShed && !ObjectID.isValid(idShed)) {
            throw new UserInputError('Invalid idShed')
        }
        // Valid pool
        if (idPool && !ObjectID.isValid(idPool)) {
            throw new UserInputError('Invalid idPool')
        }
        return await cuyDAO.getStateReports(
            idShed,
            idPool,
            reason,
            dateFrom,
            dateTo,
            skip,
            limit,
            "death"
        )
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve, Finds and returns all saca cuys
 */
const getSacaCuysReport = async (_, {
    idShed,
    idPool,
    dateFrom,
    dateTo,
    reason,
    skip,
    limit
}) => {
    try {
        // Valid shed
        if (idShed && !ObjectID.isValid(idShed)) {
            throw new UserInputError('Invalid idShed')
        }
        // Valid pool
        if (idPool && !ObjectID.isValid(idPool)) {
            throw new UserInputError('Invalid idPool')
        }
        return await cuyDAO.getStateReports(
            idShed,
            idPool,
            reason,
            dateFrom,
            dateTo,
            skip,
            limit,
            "saca"
        )
    } catch (error) {
        throw error
    }
}

module.exports = {
    mutations: {
        addCuy,
        updateCuy,
        activateCuy,
        deactivateCuy,
        deleteCuy,
        addWeightToCuy,
        updateWeightOfCuy,
        removeWeightOfCuy,
        registerSacaCuy,
        updateSacaCuy,
        removeSacaCuy,
        registerDeathCuy,
        updateDeathOfCuy,
        removeDeathCuy
    },
    queries: {
        getCuyByID,
        getCuyByEarring,
        getCuysByRace,
        getCuysByGenre,
        getAllCuysOfPool,
        cuys,
        getDeathCuysReport,
        getSacaCuysReport
    },
    getCuysInPool,
    getCuysOfPool,
    getTotalNumberCuysInPool,
    getCuyListByFilterQuery,
    getTotalNumCuysByFilterQuery,
    getAllCuysList,
    getTotalNumberCuys
}