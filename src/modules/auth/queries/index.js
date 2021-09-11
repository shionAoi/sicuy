const userQueryDef = require('./user');
const roleQueryDef = require('./role');
const operationQueryDef = require('./operation');

module.exports = {
    queries: [
        userQueryDef,
        roleQueryDef,
        operationQueryDef
    ]
};