FROM node:12-buster
MAINTAINER Bryan Green "bryogreen@gmail.com"

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

COPY package.json ./
USER node

COPY --chown=node:node ../../ ../../

RUN yarn
CMD node index.js

