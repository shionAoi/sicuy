const { gql } = require('apollo-server-express');

const cuyMutationDef = gql`
    extend type Mutation{
        "addCuy mutation adds a cuy"
        addCuy(
            "cuy to add"
            cuy: CuyInput!
        ): Cuy @isAuthenticated
        "updateCuy mutation updates cuy by its ID"
        updateCuy(
            "ID of cuy"
            idCuy: ID!
            "object with fields to update"
            update: CuyUpdate!
        ): Cuy @isAuthenticated
        "activateCuy mutation activates a cuy by its ID"
        activateCuy(
            "ID of cuy to activate"
            idCuy: ID!
        ): Boolean @isAuthenticated
        "deactivateCuy mutation deactivates a cuy by its ID"
        deactivateCuy(
            "ID of cuy to deactivate"
            idCuy: ID!
        ): Boolean @isAuthenticated
        "deleteCuy mutation deletes a cuy by its ID"
        deleteCuy(
            "ID of cuy to delete"
            idCuy: ID!
        ): Boolean @isAuthenticated
        "addWeightToCuy mutation adds weight to cuy"
        addWeightToCuy(
            "ID of cuy"
            idCuy: ID!
            "weight to add"
            weight: WeightInput!
        ): Boolean @isAuthenticated
        "updateWeightOfCuy mutation to update weight of cuy"
        updateWeightOfCuy(
            "ID of cuy"
            idCuy: ID!
            "ID of weight in cuy"
            idWeight: ID!
            "update of weight"
            update: WeightUpdate!
        ): Boolean @isAuthenticated
        "removeWeightOfCuy mutation to remove weight of cuy"
        removeWeightOfCuy(
            "ID of cuy"
            idCuy: ID!
            "ID of weight in cuy"
            idWeight: ID!
        ): Boolean @isAuthenticated
        "registerSacaCuy mutation to add saca of cuy"
        registerSacaCuy(
            "ID of cuy"
            idCuy: ID!
            "Saca input of cuy"
            saca: SacaInput!
        ): Boolean @isAuthenticated
        "updateSacaCuy mutation to update saca of cuy"
        updateSacaCuy(
            "ID of cuy"
            idCuy: ID!
            "Saca input of cuy"
            saca: SacaUpdate!
        ): Boolean @isAuthenticated
        "removeSacaCuy mutation to remove saca of cuy"
        removeSacaCuy(
            "ID of Cuy"
            idCuy: ID!
        ): Boolean @isAuthenticated
        "registerDeathCuy mutation to add death cuy"
        registerDeathCuy(
            "ID of cuy"
            idCuy: ID!
            "Death input of cuy"
            death: DeathInput!
        ): Boolean @isAuthenticated
        "updateDeathOfCuy mutation to update death of cuy"
        updateDeathOfCuy(
            "ID of cuy"
            idCuy: ID!
            "Death update of cuy"
            death: DeathUpdate!
        ): Boolean @isAuthenticated
        removeDeathCuy(
            "ID of cuy"
            idCuy: ID!
        ): Boolean @isAuthenticated
    }
`

module.exports = cuyMutationDef;