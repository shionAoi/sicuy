const operationDao = require('../../../models/operation.model');

/**
  * Query resolve, operationParent filter operations array of IDs to
  * only include operations from parent Role.
  * @argument {parent} parent - role parent
  * @returns {[operation]} Returns a list of operations
*/
const operationParent = async parent => {
    try {
        return await operationDao.getOperationsByIds(parent.operations)
    } catch (error) {
        throw new Error(`Error. ${error}`)
    }
}

/**
  * Query resolve, operationById finds and returns a operation by its ID.
  * @argument {String} idOperation - operation Id
  * @returns {operation} Returns operation
*/
const operationById = async (_, { idOperation }) => {
    try {
        return await operationDao.getOperationById(idOperation)
    } catch (error) {
        throw error
    }
}

/**
 * Query resolve, roles finds and returns all operations
 * @returns {[operation]} Return list of operations
 */
const operations = async (_, args) => {
    try {
        return await operationDao.getAllOperations()
    } catch (error) {
        throw error
    }
}

module.exports = {
    operationParent,
    operationById,
    operations
}