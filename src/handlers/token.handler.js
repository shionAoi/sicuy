const express = require('express');
const RequestIp = require('@supercharge/request-ip');
const tokenUtil = require('../utils/token');
const logger = require('../utils/winston');
const redis = require('../utils/redis');
const UserDao = require('../models/user.model');
const config = require('../config');
const router = express.Router();

router.get('/refresh-token', async (req, res) => {
    try {
        // verify correct request
        if (!req) {
            throw new Error('No request')
        }
        // get the jwt in the headers
        const header = req.headers.authorization || req.get('x-token');
        let tokenHeader
        // if not jwt
        if (header) {
            tokenHeader = header.replace('Bearer ', '');
            // Verify decoded jwt
            let decodedToken = await tokenUtil.getDecodedTokenRefresh(tokenHeader);
            let ip = await RequestIp.getClientIp(req);
            let key = decodedToken.userId + "_token_" + ip;
            let refToken = await redis.getValueOfKey(key);
            if (!refToken) {
                return res.status(401).send('Unauthorized')
            } else {
                // Get user of decodedToken
                const user = await UserDao.getUserById(decodedToken.userId);
                // Generate access token
                const token = await tokenUtil.createToken({
                    userId: user._id
                });
                // Set new token refresh and send token access
                const token_refresh = await tokenUtil.createRefreshToken(user._id);
                // Delete old key in cache
                await redis.deleteKey(key);
                await redis.setKey(key, token_refresh);
                await redis.setTimeOut(key, config.JWT_REFRESH_TIME / 1000);
                return res.status(200).json({
                    token: token,
                    tokenExpiration: config.JWT_LIFE_TIME,
                    token_refresh: token_refresh
                })
            }
        } else {
            return res.status(401).send('Unauthorized no token')
        }
    } catch (error) {
        logger.error(error.message);
        return res.status(500).send(error.message)
    }
})

router.post('/revoke-token', async (req, res) => {
    try {
        // verify correct request
        if (!req) {
            throw new Error('No request')
        }
        // get the jwt in the headers
        const header = req.headers.authorization || req.get('x-token');
        let tokenHeader
        if (header) {
            tokenHeader = header.replace('Bearer ', '');
            // Verify decoded jwt
            let decodedToken = await tokenUtil.getDecodedToken(tokenHeader);
            // Delete all refresh_token of user
            await redis.deleteAllKeysPrefix(decodedToken.userId + "_token_");
            return res.status(200)
        } else {
            return res.status(401).send('Unauthorized no token')
        }
    } catch (error) {
        logger.error(error.message);
        return res.status(403).send('Forbidden')
    }
})

module.exports = router