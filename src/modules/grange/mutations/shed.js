const { gql } = require('apollo-server-express');

const shedMutationDef = gql`
    extend type Mutation{
        "addShed Mutation adds a shed"
        addShed(shed: ShedInput!): Shed @isAuthenticated
        "updateShed Mutation updates a shed by its ID"
        updateShed(
            "Id of shed"
            idShed: ID!
            "Object with fields to update"
            update: ShedUpdate!
        ): Shed @isAuthenticated
        "deleteShed Mutation deletes shed by its ID"
        deleteShed(idShed: ID!): Boolean @isAuthenticated
        "deactivateShed Mutation deactivates shed by its ID"
        deactivateShed(idShed: ID!): Boolean @isAuthenticated
        "activateShed Mutation activates shed by its ID"
        activateShed(idShed: ID!): Boolean @isAuthenticated
    }
`

module.exports = shedMutationDef;