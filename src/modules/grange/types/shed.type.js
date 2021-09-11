const { gql } = require('apollo-server-express');

const shedTypeDef = gql`
  type Shed{
      _id: ID
      name: String
      details: String
      code: String
      created_date: DateTime
      updated_date: DateTime
      active: Boolean
      male_number_cuys: Int
      female_number_cuys: Int
      children_number_cuys: Int
      total_number_cuys: Int
      pools(skip: Int, limit: Int, filter: Boolean!): PoolPaginationShed
  }
  type ShedPagination{
      shedList: [Shed]
      totalNumSheds: Int
  }
  type ShedsStatistics{
      _id: ID
      name: String
      details: String
      code: String
      alive_cuys: Int
      saca_cuys: Int
      dead_cuys: Int
  }
  input ShedInput{
      name: String!
      details: String
      code: String!
  }
  input ShedUpdate{
      name: String
      details: String
      code: String
  }
`

module.exports = shedTypeDef;