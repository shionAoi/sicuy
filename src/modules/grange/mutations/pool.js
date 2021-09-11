const { gql } = require('apollo-server-express');

const poolMutationDef = gql`
    extend type Mutation{
        "addPool Mutation adds a pool"
        addPool(
            "pool to add"
            pool: PoolInput!
        ): Pool @isAuthenticated
        "updatePool Mutation updates a pool by its ID"
        updatePool(
            "ID of pool"
            idPool: ID!
            "object with fields to update"
            update: PoolUpdate!
        ): Pool @isAuthenticated
        "deletePool Mutation deletes pool by its ID"
        deletePool(
            "ID of pool to delete"
            idPool: ID!
        ): Boolean @isAuthenticated
        "deactivatePool Mutation deactivates a pool by its ID"
        deactivatePool(
            "ID of pool to deactivate"
            idPool: ID!
        ): Boolean @isAuthenticated
        "activatePool Mutation activates a pool by its ID"
        activatePool(
            "ID of pool to activate"
            idPool: ID!
        ): Boolean @isAuthenticated
    }
`

module.exports = poolMutationDef;