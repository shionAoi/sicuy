const { gql } = require('apollo-server-express');

const userQueryDef = gql`
  extend type Query{
      "userInfo query to get current user of token"
      userInfo: User @isAuthenticated
      "userById query to find and return a user by its ID"
      userById(
        "id of user"
        id: ID!
      ): User @isAuthenticated
      "users query to get all users"
      users: [User] @isAuthenticated
  }
`

module.exports = userQueryDef;