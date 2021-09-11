const express = require('express');
const fileUpload = require('express-fileupload');
const { ObjectId } = require('mongodb');
const { ApolloServer } = require('apollo-server-express');
const { express: voyagerMiddleware } = require('graphql-voyager/middleware');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require("helmet");
// Routes
const tokenRoute = require('./handlers/token.handler');
const storageRoute = require('./handlers/storage.handler');
// Middleware
// file dependencies
const context = require('./utils/context');
const schema = require('./modules');
const config = require('./config');

// Define graphql server

const options = {
    schema,
    playground: true,
    context: async ({ req }) => ({
        user: await context.getUser(req),
        ip: await context.getIp(req)
    }),
    uploads: false,
    formatError: (err) => {
        // Don't give the specific errors to the client.
        // if (err.message.startsWith("Cuy is death ")) {
        //     return new Error('Internal server error');
        // }
        // Otherwise return the original error.  The error can also
        // be manipulated in other ways, so long as it's returned.
        return err;
    }
}
if (process.env.NODE_ENV === 'production') {
    options.debug = false;
    options.introspection = true;
}

const server = new ApolloServer({ ...options });

const operations = []
const queries = Object.entries(schema.getQueryType().getFields());
queries.forEach(([_, value]) => {
    operations.push({
        "_id": new ObjectId(),
        "name": value.name,
        "description": value.description,
        "type": 0
    });
});

const mutations = Object.entries(schema.getMutationType().getFields());
mutations.forEach(([_, value]) => {
    operations.push({
        "_id": new ObjectId(),
        "name": value.name,
        "description": value.description,
        "type": 1
    });
});

// Setup express server
const app = express();

// if (process.env.NODE_ENV === 'production') {
//     app.use(helmet());
// }
app.disable('x-powered-by');
app.use(bodyParser.json());
app.use(cors());
app.use('/voyager', voyagerMiddleware({ endpointUrl: '/graphql' }));

// Set up storage
app.use(fileUpload({
    limits: { fileSize: 10 * 1024 * 1024 },
    useTempFiles: true,
    tempFileDir: '/tmp/',
    safeFileNames: true,
    preserveExtension: true,
    abortOnLimit: true
}));

// Set up routes
app.use('/storage', storageRoute);
app.use('/token', tokenRoute);

// Handle errors

app.use((error, req, res, next) => {
    if (error.message.includes('ENOENT: no such file or directory')) {
        return res.status(500).send('File not found')
    } else {
        return res.status(500).json({ error: error.message });
    }
});

// Configure route graphql
server.applyMiddleware({
    path: '/graphql',
    app,
});


module.exports = {
    app,
    operations
};

