const { gql } = require('apollo-server-express');

const userTypeDef = gql`
  type User{
      _id: ID
      names: String
      firstName: String
      lastName: String
      dni: String
      photo: String
      email: String
      phone: String
      roles: [Role]
      accessLifeCycle: Access
  }
  type AuthData {
      user: User
      token: String!
      tokenExpiration: String!
      token_refresh: String!
  }
  type UserReports{
      _id: ID
      names: String
      firstName: String
      lastName: String
  }
  type Access{
      active: Boolean
      inactive: Boolean
  }
  input AccessUpdate{
      active: Boolean
      inactive: Boolean
  }
  input UserInput{
      names: String!
      firstName: String!
      lastName: String!
      dni: String
      photo: String
      email: String!
      phone: String!
      password: String!
  }
  input UserUpdate{
      names: String
      firstName: String
      lastName: String
      dni: String
      photo: String
      email: String
      phone: String
  }
`

module.exports = userTypeDef;