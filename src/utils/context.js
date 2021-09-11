const RequestIp = require('@supercharge/request-ip');
const token = require('./token');
const userDAO = require('../models/user.model');
const logger = require('./winston');

/**
 * Find and return a user's _id using the authorization token
 * @param {request} req - The request http
 * @returns {user | null} Returns either a user or nothing
*/
const getUser = async req => {
    // verify correct request
    if (!req) {
        return null
    }
    // get the jwt in the headers
    const header = req.headers.authorization || req.get('x-token') || req.query.Authorization;
    let tokenHeader
    // if not jwt
    if (header) {
        tokenHeader = header.replace('Bearer ', '');
    } else {
        return null
    }
    try {
        // Verify and decode the jwt
        const decodedToken = await token.getDecodedToken(tokenHeader);
        return await userDAO.getUserById(decodedToken.userId);
    } catch (error) {
        logger.error(error.message)
        return null
    }
}

const getIp = async req => {
    if (!req) {
        return null
    }
    return await RequestIp.getClientIp(req)
}

module.exports = {
    getUser,
    getIp
}