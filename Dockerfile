FROM node:12-buster
MAINTAINER Bryan Green "bryogreen@gmail.com"

# Install Typescript first
RUN npm install --global typescript

RUN mkdir -p /home/node/app/node_modules &&\
 chown -R node:node /home/node/app

WORKDIR /home/node/app

# COPY package.json ./
USER node

# RUN npm install --global tsc typescript

COPY --chown=node:node . .

RUN yarn &&\
 tsc


CMD node /home/node/app/dist/index.js
