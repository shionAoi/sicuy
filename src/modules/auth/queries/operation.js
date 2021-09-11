const { gql } = require('apollo-server-express');

const operationQueryDef = gql`
  extend type Query{
      "operationById query to find and return a operation by its ID"
      operationById(
          "ID of operation to get"
          idOperation: ID!
      ): Operation @isAuthenticated
      "operations query to get all operations in collection"
      operations: [Operation] @isAuthenticated
  }
`

module.exports = operationQueryDef;