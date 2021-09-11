const { gql } = require('apollo-server-express');

const poolTypeDef = gql`
  type Pool{
      _id: ID
      type: String
      phase: String
      description: String
      code: String
      created_date: DateTime
      updated_date: DateTime
      active: Boolean
      total_population: Int
      population: [Population]
      cuys(skip: Int, limit: Int, filter: Boolean!): CuyPaginationPool
  }
  type PoolPaginationShed{
      poolList: [Pool]
      totalNumPools: Int
  }
  type PoolPagination{
      poolList: [Pool]
      totalNumPools: Int
  }
  type Pools{
      poolList: [Pool]
      totalNumPools: Int
  }
  type Population{
      genre: String
      quantity: Int
  }
  input PoolInput{
      shed: ID!
      type: String!
      phase: String!
      code: String!
      description: String
  }
  input PoolUpdate{
      type: String
      phase: String
      code: String
      description: String
  }
`

module.exports = poolTypeDef;