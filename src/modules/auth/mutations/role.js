const { gql } = require('apollo-server-express');

const roleMutationDef = gql`
  extend type Mutation{
      "addRole mutation adds a role"
      addRole(role: RoleInput!): Role @isAuthenticated
      "updateRole mutation updates a role"
      updateRole(
          "ID of role to be updated"
          idRole: ID!,
          "Object with params to update"
          role: RoleUpdate!
      ): Role @isAuthenticated
      "deleteRole mutation deletes a role"
      deleteRole(idRole: ID!): Boolean @isAuthenticated
      "addOperationToRole mutation adds a operation to role"
      addOperationToRole(
          "ID of role where to add operation"
          idRole: ID!
          "ID of operation to add"
          idOperation: ID!
      ): Boolean @isAuthenticated
      "deleteOperationOfRole mutation deletes a operation from role"
      deleteOperationOfRole(
          "ID of role where to delete operation"
          idRole: ID!
          "ID of operation to delete"
          idOperation: ID!
      ): Boolean @isAuthenticated
  }
`

module.exports = roleMutationDef;