const { gql } = require('apollo-server-express');

const roleQueryDef = gql`
  extend type Query{
      "roleById query to find and return a role by its ID"
      roleById(
          "ID of role to get"
          idRole: ID!
      ): Role @isAuthenticated
      "roles query to get all roles in collection"
      roles: [Role] @isAuthenticated
  }
`

module.exports = roleQueryDef;