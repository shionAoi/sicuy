# ---------------- Build stage
FROM node:lts-alpine AS build
WORKDIR /usr/src/app
COPY package*.json /usr/src/app/
# Install app dependencies
RUN npm ci --only=production

# ---------------- Deploy stage
FROM node:lts-alpine

# Use dumb-init
RUN apk add dumb-init

# Set environment in production
ENV NODE_ENV production

# Use node user not root
USER node

# Set work directory
WORKDIR /usr/src/app

# Bundle app source
COPY --chown=node:node --from=build /usr/src/app/node_modules /usr/src/app/node_modules
COPY --chown=node:node . /usr/src/app

EXPOSE 4041
CMD ["dumb-init", "npm", "start"]