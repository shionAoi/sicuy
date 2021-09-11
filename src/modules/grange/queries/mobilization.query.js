const { gql } = require('apollo-server-express');

const mobQueryDef = gql`
    extend type Query{
        "getMobilizationReports query to find and return mobilizations"
        getMobilizationReports(
            "Filter mobilizations by ID of cuy"
            idCuy: ID
            "Filter mobilizations by ID of origin pool"
            from: ID
            "Filter mobilizations by ID of destination pool"
            destination: ID
            "Filter mobilizations from date"
            dateFrom: DateTime
            "Filter mobilizations to date"
            dateTo: DateTime
            "Filter mobilizations by reason"
            reason: String
            "Number of mobilizations to skip"
            skip: Int
            "Number of mobilizations per page"
            limit: Int
        ): MobilizationReportPagination @isAuthenticated
    }
`

module.exports = mobQueryDef;