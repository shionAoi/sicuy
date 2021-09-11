const { gql } = require('apollo-server-express');

const rolesTypeDef = gql`
  type Role{
      _id: ID
      name: String
      description: String
      operations: [Operation]
  }
  input RoleInput{
      name: String!
      description: String
  }
  input RoleUpdate{
      name: String
      description: String
  }
`

module.exports = rolesTypeDef;