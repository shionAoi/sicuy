const { makeExecutableSchemaFromModules } = require('../utils/make-schema');

// Get modules
const auth = require('./auth');
const grange = require('./grange');

// Create schema with modules
module.exports = makeExecutableSchemaFromModules({
    modules: [
        auth,
        grange
    ]
})