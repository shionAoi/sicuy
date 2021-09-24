const { MongoClient } = require('mongodb');
const { app, operations } = require('./app');
const config = require('./config');
const UserDAO = require('./models/user.model');
const RoleDAO = require('./models/role.model');
const OperationDAO = require('./models/operation.model');
const ShedDAO = require('./models/shed.model');
const PoolDAO = require('./models/pool.model');
const CuyDAO = require('./models/cuy.model');
const MobilizationDAO = require('./models/mobilization.model');
const RedisClient = require('./utils/redis');
const logger = require('./utils/winston');

const port = config.PORT || 8000;

// Init connection and setup server
MongoClient.connect(
    config.MONGODB_URI,
    {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
        useNewUrlParser: true,
        useUnifiedTopology: true
    },
).catch(err => {
    logger.error(err.stack);
    process.exit(1);
}).then(async client => {
    // Inject client to models
    await UserDAO.injectDB(client);
    await UserDAO.createIndexes();
    await RoleDAO.injectDB(client);
    await OperationDAO.injectDB(client);
    await ShedDAO.injectDB(client);
    await ShedDAO.createIndexes();
    await PoolDAO.injectDB(client);
    await PoolDAO.createIndexes();
    await CuyDAO.injectDB(client);
    await CuyDAO.createIndexes();
    await MobilizationDAO.injectDB(client);
    await MobilizationDAO.createIndexes();
    // SetUp redis client
    await RedisClient.runRedis();
    // Save operations in db
    let dbOps = await OperationDAO.getAllOperations();
    let finalOps = await mergeOperations(operations, dbOps);
    await RedisClient.setOperationsList(finalOps);
    await OperationDAO.initOperations(finalOps);
    // Setup server
    app.listen(port, () => {
        console.log(`listening on port ${port}`);
    });
})

async function mergeOperations(newOps, dbOps) {
    let finalOps = []
    newOps.forEach(e => {
        let auxObject = dbOps.find(ob => ob.name === e.name)
        if (auxObject) {
            e["_id"] = auxObject._id
        }
        finalOps.push(e);
    })
    return finalOps
}