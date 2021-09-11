const mongo = require('mongodb');
const bcrypt = require('bcrypt');
const { AuthenticationError, UserInputError, ApolloError } = require('apollo-server-express');
const re2 = require('re2');
const tokenSet = require('../../../utils/token');
const userDao = require('../../../models/user.model');
const roleDAO = require('../../../models/role.model');
const cuyDAO = require('../../../models/cuy.model');
const mobilizationDAO = require('../../../models/mobilization.model');
const redis = require('../../../utils/redis');
const config = require('../../../config');

const SALT_ROUNDS = 12
// const regPassword = /(?=[\s\S]*[A-Z])(?=[\s\S]*[a-z])(?=[\s\S]*[0-9]).{8,32}/;
// const regex = new re2(regPassword);
const regexEmail = new re2(/(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/);
const ObjectID = mongo.ObjectID;

/**
  * Mutation resolve, Logins user with email and password.
  * @argument {string} email - email input of user
  * @argument {string} password - password input of user
  * @returns {user} Returns user
*/
const login = async (_, { email, password }, { ip }) => {
    try {
        const user = await userDao.getUserByEmail(email);
        if (!user) {
            throw new AuthenticationError('User not found');
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new AuthenticationError('Incorrect password')
        }
        // Generate access token
        const token = await tokenSet.createToken({
            userId: user._id,
        });

        const token_refresh = await tokenSet.createRefreshToken(user._id);
        // Store refresh key in cache
        const key = user._id.toHexString() + "_token_" + ip;
        await redis.setKey(key, token_refresh);
        await redis.setTimeOut(key, config.JWT_REFRESH_TIME / 1000);

        return {
            user: user,
            token: token,
            tokenExpiration: config.JWT_LIFE_TIME,
            token_refresh: token_refresh
        }
    } catch (error) {
        throw error
    }
};

/**
 * Query resolve, refreshToken refreshes token of user already logged
 * @returns {string} Returns new token
 */
const refreshToken = async (_, args, { user }) => {
    try {
        const token = await tokenSet.createToken(user._id);
        return {
            token: token,
            tokenExpiration: config.JWT_LIFE_TIME
        }
    } catch (error) {
        throw new ApolloError('Error. Something went wrong refreshing token')
    }
}

/**
  * Mutation resolve, Signup user with email and password.
  * @argument {UserInputType} args - user input in args
  * @returns {user} Returns added user
*/
const signup = async (_, args) => {
    var userArg = args.user;
    let id
    try {
        // if (regex.exec(userArg.password)) {
        //     throw UserInputError('Password not secure')
        // }
        if (regexEmail.exec(userArg.email) === null) {
            throw new UserInputError('Invalid email')
        }
        const hashedPassword = await bcrypt.hash(userArg.password, SALT_ROUNDS);
        id = new ObjectID();
        userArg["_id"] = id;
        userArg["password"] = hashedPassword;
        userArg["roles"] = [];
        const { success } = await userDao.addUser(userArg);
        if (!success) {
            throw new ApolloError('Error adding user')
        }
        return userArg
    } catch (error) {
        throw new ApolloError(`${error}`)
    }
}

/**
 * Mutation resolve, resetPassword resets password of user
 * @argument {string} oldPassword - Old password of user
 * @argument {string} newPassword - New password of user
 * @returns {boolean} Return true if resets
 */
const resetPasswordOfUser = async (_, { oldPassword, newPassword }, { user }) => {
    try {
        const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
        if (!isPasswordValid) {
            throw new AuthenticationError('Incorrect password')
        }
        // if (regex.exec(newPassword)) {
        //     throw UserInputError('Password not secure')
        // }
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await userDao.updatePasswordOfUser(user._id.toHexString(), hashedPassword);
        return true
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, updates a user by its ID
 * @param {string} idUser - ID of user to update
 * @param {UserUpdateType} user - Object with params to update
 * @returns {user} Returns added user 
 */
const updateUser = async (_, { idUser, user }) => {
    try {
        if (user.email) {
            if (regexEmail.exec(userArg.email) === null) {
                throw new UserInputError('Invalid email')
            }
        }
        await userDao.updateUser(idUser, user);
        let updateNameUser = {}
        if (user.names !== undefined) {
            updateNameUser["names"] = user.names;
        }
        if (user.lastName !== undefined) {
            updateNameUser["lastName"] = user.lastName;
        }
        if (user.firstName !== undefined) {
            updateNameUser["firstName"] = user.firstName;
        }
        if (Object.entries(updateNameUser).length !== 0) {
            await cuyDAO.updateUserInCuysCollection(idUser, updateNameUser);
            await mobilizationDAO.updateUserInMobilizationCollection(idUser, updateNameUser);
        }
        return await userDao.getUserById(idUser)
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, deletes a user by its ID
 * @param {string} idUser - ID of user to delete
 * @returns {boolean} Returns true if deleted 
 */
const deleteUser = async (_, { idUser }) => {
    try {
        const { success } = await userDao.deleteUser(idUser);
        if (success) {
            await redis.deleteAllKeysPrefix(idUser)
        }
        return success
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, adds role to user
 * @param {string} idUser - ID of user
 * @param {string} idRole - ID of role to add
 * @returns {boolean} Returns true if added
 */
const addRoleToUser = async (_, { idUser, idRole }) => {
    try {
        const { success } = await userDao.addRoleToUser(idUser, idRole);
        if (success) {
            const isUserInRedis = await redis.getOperationsOfUser(new ObjectID.createFromHexString(idUser));
            if (isUserInRedis !== undefined && isUserInRedis.length != 0) {
                const { operations } = await roleDAO.getRoleById(idRole);
                for (const operation of operations) {
                    await redis.pushOperationOfUser(operation.toHexString(), idUser + "_operation")
                }
            }
            return success
        } else {
            throw new ApolloError('Something went wrong in addRoleToUser')
        }
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, deletes role of user
 * @param {string} idUser - ID of user
 * @param {string} idRole - ID of role to add
 * @returns {boolean} Returns true if added
 */
const deleteRoleOfUser = async (_, { idUser, idRole }) => {
    try {
        const { success } = await userDao.deleteRoleOfUser(idUser, idRole);
        if (success) {
            const isUserInRedis = await redis.getOperationsOfUser(new ObjectID.createFromHexString(idUser));
            if (isUserInRedis !== undefined && isUserInRedis.length != 0) {
                const { operations } = await roleDAO.getRoleById(idRole);
                for (const operation of operations) {
                    await redis.delOperationOfUser(idUser + "_operation", operation.toHexString())
                }
            }
            return success
        } else {
            throw new ApolloError('Something went wrong in deleteRoleOfUser')
        }
    } catch (error) {
        throw error
    }
}

/**
 * Mutation resolve, Updates access of user
 * @argument {string} idUser - ID of user
 * @argument {Access} access - Access to update
 * @returns {boolean} Returns either a success or an error
 */
const updateAccessOfUser = async (_, { idUser, access }) => {
    try {
        const { success } = await userDao.updateAccessOfUser(idUser, access);
        return success
    } catch (error) {
        throw error
    }
}

/**
  * Query resolve, userById finds and returns a user by its ID.
  * @argument {String} id - user Id
  * @returns {user} Returns user
*/
const userById = async (_, { id }) => {
    try {
        return await userDao.getUserById(id);
    } catch (error) {
        throw new UserInputError(`Error getting user. ${error}`)
    }
}

/**
 * Query resolve, userInfo finds and return a user saved in the context
 * @returns {user} Return user
 */
const userInfo = async (_, args, { user }) => {
    return user
}

/**
 * Query resolve, users finds and returns all users
 * @returns {[user]} Return list of users
 */
const users = async (_, args) => {
    try {
        return await userDao.getAllUsers()
    } catch (error) {
        throw new ApolloError(`Error. ${error}`)
    }
}

module.exports = {
    queries: {
        userInfo,
        userById,
        users,
    },
    mutations: {
        login,
        signup,
        updateUser,
        deleteUser,
        addRoleToUser,
        deleteRoleOfUser,
        resetPasswordOfUser,
        updateAccessOfUser
    },
}