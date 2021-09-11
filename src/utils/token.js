const jwt = require('jsonwebtoken');
const { AuthenticationError } = require('apollo-server-express');
const config = require('../config');
const { error } = require('winston');

// Create jsonwebtoken
const createToken = user => new Promise((resolve, reject) => {
    jwt.sign({
        ...user
    }, config.JWT_PRIVATE, {
        expiresIn: config.JWT_LIFE_TIME,
        algorithm: config.JWT_ALGORITHM
    }, (error, token) => {
        if (error) {
            return reject(new AuthenticationError(`${error}`))
        }
        resolve(token)
    })
});

const createRefreshToken = userID => new Promise((resolve, reject) => {
    jwt.sign({ userId: userID }, config.JWT_REFRESH_SECRET, {
        expiresIn: config.JWT_REFRESH_TIME,
        algorithm: config.JWT_REFRESH_ALGORITHM
    }, (err, token) => {
        if (err) {
            return reject(new AuthenticationError(`${error}`))
        }
        resolve(token)
    })
});

// Decode jsonwebtoken
const getDecodedToken = token => new Promise((resolve, reject) => {
    jwt.verify(token, config.JWT_PUBLIC, { algorithms: [config.JWT_ALGORITHM] }, (error, decodedToken) => {
        if (error) {
            return reject(error)
        }

        if (!decodedToken.exp || !decodedToken.iat) {
            return reject(new Error(`Token had no 'exp' or 'iat' payload`))
        }

        resolve(decodedToken)
    })
})

const getDecodedTokenRefresh = token => new Promise((resolve, reject) => {
    jwt.verify(token, config.JWT_REFRESH_SECRET, { algorithms: [config.JWT_REFRESH_ALGORITHM] }, (error, decodedToken) => {
        if (error) {
            return reject(error)
        }

        if (!decodedToken.exp || !decodedToken.iat) {
            return reject(new Error(`Token had no 'exp' or 'iat' payload`))
        }
        resolve(decodedToken)
    })
})

module.exports = {
    createToken,
    getDecodedToken,
    createRefreshToken,
    getDecodedTokenRefresh
}