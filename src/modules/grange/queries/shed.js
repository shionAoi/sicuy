const { gql } = require('apollo-server-express');

const shedQueryDef = gql`
    extend type Query{
        "getShedByID query to find and return a shed by its ID"
        getShedByID(
            "ID of shed to get"
            idShed: ID!
        ): Shed @isAuthenticated
        "sheds query to find and return all sheds"
        sheds(
            "Skip n sheds"
            skip: Int
            "Return n sheds"
            limit: Int
            "Filter sheds: true (active)/false (inactive)"
            filter: Boolean!
        ): ShedPagination @isAuthenticated
        "getShedsStatistics query to get table of population"
        getShedsStatistics: [ShedsStatistics] @isAuthenticated
    }
`

module.exports = shedQueryDef;