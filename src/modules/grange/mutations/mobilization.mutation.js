const { gql } = require('apollo-server-express');

const mobMutationDef = gql`
    extend type Mutation{
        "addMobilization mutation adds a mobilization"
        addMobilization(
            "mobilization of cuy"
            mobilization: MobilizationInput!
        ): Mobilization @isAuthenticated
        "updateMobilization mutation updates a mobilization"
        updateMobilization(
            "ID of mobilization"
            idMobilization: ID!
            "update input"
            update: MobilizationUpdate!
        ): Mobilization @isAuthenticated
    }
`
module.exports = mobMutationDef;