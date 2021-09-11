const { gql } = require('apollo-server-express');

const mobilizationTypeDef = gql`
    "Mobilization type"
    type Mobilization{
        "ID of mobilization"
        _id: ID
        "cuy mobilized"
        cuy: Cuy
        "Pool of origin"
        origin: Pool
        "Pool of destine"
        destination: Pool
        "user that made mobilization"
        user: UserReports
        "date of creation"
        created_date: DateTime
        "last date of update in document"
        updated_date: DateTime
        "Date when cuy was mobilized"
        date: DateTime
        "Reason for mobilization"
        reason: String
        "Url of document that proves the mobilization"
        reference_doc: String
    }
    "MobilizationReport type"
    type MobilizationReport{
        "ID of mobilization"
        _id: ID
        "State of cuy active or inactive"
        cuy_active: Boolean
        "Earring of cuy"
        cuy_earring: String
        "Genre of cuy"
        cuy_genre: String
        "Race of cuy"
        cuy_race: String
        "Death object of cuy"
        cuy_death: Death
        "Saca object of cuy"
        cuy_saca: Saca
        "Code of origin pool of mobilization"
        origin_code: String
        "Phase of origin pool of mobilization"
        origin_phase: String
        "Code of destination pool of mobilization"
        destination_code: String
        "Phase of destination pool of mobilization"
        destination_phase: String
        "Date of mobilization"
        date: DateTime
        "Reason of mobilization"
        reason: String
        "Reference path document of mobilization"
        reference_doc: String
        "User of mobilization"
        user: UserReports
        "Date of creation of mobilization"
        created_date: DateTime
        "Date of update of mobilization"
        updated_date: DateTime
    }
    "MobilizationReportPagination type"
    type MobilizationReportPagination{
        "List of all mobilizations"
        mobilizationList: [MobilizationReport]
        "total number of mobilizations"
        totalNumMobilizations: Int
    }
    "MobilizationPagination type"
    type MobilizationPagination{
        "List of all mobilizations"
        mobilList: [Mobilization]
        "total number of mobilizations"
        totalNumMobil: Int
    }
    "Input document when mobilization is added"
    input MobilizationInput{
        "ID of cuy to be mobilized"
        cuy: ID!
        "pool ID origin of cuy"
        origin: ID!
        "pool ID destine of cuy"
        destination: ID!
        "Date when cuy was mobilized"
        date: DateTime!
        "Reason why cuy is being mobilized"
        reason: String!
        "Url of reference document"
        reference_doc: String
    }
    "Update document when mobilization is updated"
    input MobilizationUpdate{
        "Date when cuy was mobilized"
        date: DateTime
        "Reason why cuy is being mobilized"
        reason: String
        "Url of reference document"
        reference_doc: String
    }
`

module.exports = mobilizationTypeDef;