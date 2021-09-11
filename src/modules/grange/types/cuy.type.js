const { gql } = require('apollo-server-express');

const cuyTypeDef = gql`
  enum GenreCuy{
      MACHO
      HEMBRA
      CRIA
  }
  "Cuy type"
  type Cuy{
      "ID of cuy"
      _id: ID
      "Earring of cuy"
      earring: String
      "Race of cuy"
      race: String
      "Genre of cuy"
      genre: String
      "Photo of the last weight measurement"
      current_photo: String
      "Color of cuy"
      color: String
      "Description of cuy"
      description: String
      "Observation of cuy"
      observation: String
      "Date of creation in database"
      created_date: DateTime
      "Last date of update in database"
      updated_date: DateTime
      "Birthday of cuy"
      birthday_date: DateTime
      "Active or Inactive cuy"
      active: Boolean
      "Last weight measurement"
      current_weight: Float
      "All weight measurements"
      weights: [Weight]
      "Death of cuy"
      death: Death
      "Saca of cuy"
      saca: Saca
  }
  type CuyReport{
      _id: ID
      earring: String
      race: String
      genre: String
      current_photo: String
      current_weight: Float
      birthday_date: DateTime
      shed_code: String
      shed_name: String
      pool_code: String
      pool_phase: String
      death: Death
      saca: Saca
  }
  type CuyReportPagination{
      "List of all cuys"
      cuyList: [CuyReport]
      "Total number of cuys"
      totalNumCuys: Int
  }
  type CuyPaginationPool{
      cuyList: [Cuy]
      totalNumCuys: Int
  }
  type CuyPagination{
      cuyList: [Cuy]
      totalNumCuys: Int
  }
  type Cuys{
      cuyList: [Cuy]
      totalNumCuys: Int
  }
  input CuyInput{
      pool: ID!
      earring: String!
      race: String!
      genre: GenreCuy!
      color: String!
      description: String
      observation: String
      birthday_date: DateTime!
  }
  input CuyUpdate{
      earring: String
      race: String
      genre: GenreCuy
      color: String
      description: String
      observation: String
      birthday_date: DateTime
  }
  type Death{
      date: DateTime
      reason: String
      certified_by: UserReports
      reference_doc: String
      user: UserReports
  }
  input DeathInput{
      date: DateTime!
      reason: String!
      certified_by: ID!
      reference_doc: String
  }
  input DeathUpdate{
      date: DateTime
      reason: String
      certified_by: ID
      reference_doc: String
  }
  type Weight{
      _id: ID
      user: UserReports
      created_date: DateTime
      updated_date: DateTime
      weight: Float
      photo: String
  }
  input WeightInput{
      weight: Float!
      photo: String!
  }
  input WeightUpdate{
      weight: Float
      photo: String
  }
  type Saca{
      user: UserReports
      certified_by: UserReports
      reason: String
      reference_doc: String
      created_date: DateTime
      updated_date: DateTime
      date: DateTime
  }
  input SacaInput{
      certified_by: ID!
      reason: String!
      reference_doc: String
      date: DateTime!
  }
  input SacaUpdate{
      certified_by: ID
      reason: String
      reference_doc: String
      date: DateTime
  }
`

module.exports = cuyTypeDef;