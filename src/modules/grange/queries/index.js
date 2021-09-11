const shedQueryDef = require('./shed');
const poolQueryDef = require('./pool');
const cuyQueryDef = require('./cuy');
const mobiQueryDef = require('./mobilization.query');

module.exports = {
    queries: [
        shedQueryDef,
        poolQueryDef,
        cuyQueryDef,
        mobiQueryDef
    ]
};