const { gql } = require('apollo-server-express');

const poolQueryDef = gql`
    extend type Query{
        "getPoolByID query to find a pool by its ID"
        getPoolByID(
            "ID of pool"
            idPool: ID!
        ): Pool @isAuthenticated
        "getPoolByCode query to find a pool by its code"
        getPoolByCode(
            "code of pool"
            code: String!
        ): Pool @isAuthenticated
        "getPoolsByShed query to find and return all pool of shed"
        getPoolsByShed(
            "ID of shed"
            idShed: ID!
            "number of pools to skip"
            skip: Int
            "number of pools per page"
            limit: Int
            "filter active or inactive pools"
            filter: Boolean!
        ): PoolPaginationShed @isAuthenticated
        "getPoolsByType query to find pools by their type"
        getPoolsByType(
            "ID of shed"
            idShed: ID!
            "type to filter pools"
            type: String!
            "number of pools to skip"
            skip: Int
            "number of pools per page"
            limit: Int
            "filter active or inactive pools"
            filter: Boolean!
        ): PoolPagination @isAuthenticated
        "getPoolsByPhase query to find pools by their phase"
        getPoolsByPhase(
            "ID of shed"
            idShed: ID!
            "phase to filter pools"
            phase: String!
            "number of pools to skip"
            skip: Int
            "number of pools per page"
            limit: Int
            "filter active or inactive pools"
            filter: Boolean!
        ): PoolPagination @isAuthenticated
        "pools query to find and return all pools"
        pools(
            "number of pools to skip"
            skip: Int
            "number of pools per page"
            limit: Int
            "filter active or inactive pools"
            filter: Boolean!
        ): Pools @isAuthenticated
    }
`

module.exports = poolQueryDef;