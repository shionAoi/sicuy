const { gql } = require('apollo-server-express');

const operationTypeDef = gql`
  type Operation{
      _id: ID
      name: String
      description: String
      type: Int
  }
`

module.exports = operationTypeDef;
