# PROJECT CUYS express back-end
Guinea pig breeding and guinea pig management project, using MEAN stack

## Stack technologies
- NodeJS
- Express
- GraphQL
- MongoDB
- Redis for cache
- Docker

## Previus installs

### Nodejs ubuntu
- `curl -fsSL https://deb.nodesource.com/setup_15.x | sudo -E bash -`
- `sudo apt-get install -y nodejs`

### MongoDB docker
- Follow official guide [install mongo container](https://hub.docker.com/_/mongo)\
**Note: You can [install MongoDB directly in your computer](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/#install-mongodb-community-edition)**

### Redis docker
- Follow official guide [redis in docker](https://hub.docker.com/_/redis/).\
**Note: You can [install redis](https://redis.io/download)**


## Getting started

1. First clone or make a fork of this repository.
2. Inside project: `cd project_cuys01`
3. Run in console `npm i`

## Config environment variables

This project use variables to define configurations as follows:

- PORT : port where project will run
- MONGODB_URI: URI for mongodb connection
- MONGO_DB_NAME: Database name
- POOLS: Number of pools for mongodb
- JWT_LIFE_TIME: Life time for jsonwebtoken
- JWT_PRIVATE: Base 64 private key of token
- JWT_PUBLIC: Base 64 public key of token
- JWT_ALGORITHM: RS256
- REDIS_URL: Redis URI
- REDIS_PASSWORD: Redis requirepass
- STORAGE_PATH_PHOTOS: Storage for photos
- STORAGE_PATH_DOCS: Storage for docs

Put all environment variables inside of .env file and this file have to be at level of packacge.json

## Available scripts

### `npm start`

Runs the app in production mode using pm2-runtime

### `npm run dev`

Runs the app in development mode using nodemon

### `npm run test`

Launches the test runner in the interactive watch mode.

## Learn More

Visit official documentacion of consults in the api in https://project-cuys01.herokuapp.com/voyager

**Note: If you find some bug or have questions, please contact me sending an email to javier.jail.cornejo@gmail.com**