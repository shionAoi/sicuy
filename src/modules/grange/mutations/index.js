const shedMutationDef = require('./shed');
const poolMutationDef = require('./pool');
const cuyMutationDef = require('./cuy');
const mobMutationDef = require('./mobilization.mutation');

module.exports = {
    mutations: [
        shedMutationDef,
        poolMutationDef,
        cuyMutationDef,
        mobMutationDef
    ]
}