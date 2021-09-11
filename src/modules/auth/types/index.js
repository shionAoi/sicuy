const operationTypes = require('./operation');
const userTypes = require('./user');
const rolesTypes = require('./roles');

module.exports = {
    types: [
        operationTypes,
        userTypes,
        rolesTypes
    ]
};