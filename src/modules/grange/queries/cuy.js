const { gql } = require('apollo-server-express');

const cuyQueryDef = gql`
    extend type Query{
        "getCuyByID query finds and returns cuy by its ID"
        getCuyByID(
            "ID of cuy"
            idCuy: ID!
        ): Cuy @isAuthenticated
        "getCuyByEarring query finds and returns a cuy by its earring"
        getCuyByEarring(
            "earring of cuy"
            earring: String!
        ): Cuy @isAuthenticated
        "getCuysByRace query finds and returns a list of cuys by their race"
        getCuysByRace(
            "race of cuy"
            race: String!
            "skip n cuys"
            skip: Int
            "get n cuys per page"
            limit: Int
            "filter active or inactive cuys"
            filter: Boolean!
        ): CuyPagination @isAuthenticated
        "getCuysByGenre query finds and returns a list of cuys by their genre"
        getCuysByGenre(
            "genre of cuy"
            genre: GenreCuy!
            "skip n cuys"
            skip: Int
            "get n cuys per page"
            limit: Int
            "filter active or inactive cuys"
            filter: Boolean!
        ): CuyPagination @isAuthenticated
        "getAllCuysOfPool query finds and returns all cuys in Pool"
        getAllCuysOfPool(
            "ID of pool"
            idPool: ID!
            "skip n cuys"
            skip: Int
            "get n cuys per page"
            limit: Int
            "filter active or inactive cuys"
            filter: Boolean!
        ): CuyPaginationPool @isAuthenticated
        "cuys query finds and returns all cuys"
        cuys(
            "skip n cuys"
            skip: Int
            "get n cuys per page"
            limit: Int
            "filter active or inactive cuys"
            filter: Boolean!
        ): Cuys @isAuthenticated
        "getDeathCuysReport query finds and returns all death cuys"
        getDeathCuysReport(
            "Filter by shed"
            idShed: ID
            "Filter by pool"
            idPool: ID
            "Filter cuys from date"
            dateFrom: DateTime
            "Filter cuys to date"
            dateTo: DateTime
            "Filter cuys by reason"
            reason: String
            "Number of cuys to skip"
            skip: Int
            "Number of cuys per page"
            limit: Int
        ): CuyReportPagination @ isAuthenticated
        "getSacaCuysReport query finds and returns all Saca cuys"
        getSacaCuysReport(
            "Filter by shed"
            idShed: ID
            "Filter by pool"
            idPool: ID
            "Filter cuys from date"
            dateFrom: DateTime
            "Filter cuys to date"
            dateTo: DateTime
            "Filter cuys by reason"
            reason: String
            "Number of cuys to skip"
            skip: Int
            "Number of cuys per page"
            limit: Int
        ): CuyReportPagination @ isAuthenticated
    }
`

module.exports = cuyQueryDef;