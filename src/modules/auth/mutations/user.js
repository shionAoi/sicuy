const { gql } = require('apollo-server-express');

const userMutationDef = gql`
  extend type Mutation{
      "login mutation to login in system"
      login(
          "email of user"
          email: String!,
          "password of user"
          password: String!
      ): AuthData
      "signup mutation to add user"
      signup(user: UserInput!): User
      "updateUser mutation to update user"
      updateUser(
        idUser: ID!
        user: UserUpdate!
      ): User @isAuthenticated
      "deleteUser mutation to delete user"
      deleteUser(idUser: ID!): Boolean @isAuthenticated
      "addRoleToUser mutation to add role to a user"
      addRoleToUser(idUser: ID!, idRole: ID!): Boolean @isAuthenticated
      "deleteRoleOfUser mutation to delete role from a user"
      deleteRoleOfUser(idUser: ID!, idRole: ID!): Boolean @isAuthenticated
      "resetPasswordOfUser mutation to reset password of user"
      resetPasswordOfUser(oldPassword: String!, newPassword: String!): Boolean @isAuthenticated
      "updateAccessOfUser mutation to grant access to user for active or inactive objects"
      updateAccessOfUser(idUser: ID!, access: AccessUpdate!): Boolean @isAuthenticated
  }
`

module.exports = userMutationDef;