const authDirective = require('./auth-directive');

module.exports = {
    typeDefs: [
        authDirective.typeDef
    ],
    schemaDirectives: {
        isAuthenticated: authDirective.directive
    }
}