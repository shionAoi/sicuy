const logger = require("../utils/winston");
const context = require('../utils/context');

const validRoute = async (req, res, next) => {
    const user = await context.getUser(req);
    if (!user || user.roles.length === 0) {
        return res.status(401).send('Forbidden')
    } else {
        req.user = user;
        next();
    }
}

module.exports = {
    validRoute
}