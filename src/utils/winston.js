const appRoot = require('app-root-path');
const winston = require('winston');

var options = {
    file: {
        level: 'info',
        filename: `${appRoot}/logs/app.log`,
        handleExceptions: true,
        json: true,
        maxsize: 5242880,
        maxFiles: 5,
        colorize: true
    },
    console: {
        level: 'debug',
        handleExceptions: true,
        json: false,
        colorize: true
    }
}

var logger = winston.createLogger({
    transports: [
        new winston.transports.Console(options.console)
    ],
    exitOnError: false
});

// if (process.env.NODE_ENV !== 'production') {
//     logger.add(new winston.transports.Console(options.console));
// }

module.exports = logger;