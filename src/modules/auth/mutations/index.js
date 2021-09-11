const userMutationDef = require('./user');
const roleMutationDef = require('./role');

module.exports = {
    mutations: [
        userMutationDef,
        roleMutationDef
    ]
}