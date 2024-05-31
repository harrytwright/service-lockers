#####################################
#                                   #
#               Base                #
#                                   #
#####################################

FROM node:20-alpine AS base

RUN apk update && \
    apk add --no-cache tini

ENTRYPOINT ["/sbin/tini", "--"]

#####################################
#                                   #
#               BUILD               #
#                                   #
#####################################

FROM base AS build

ARG NPM_TOKEN

RUN mkdir -p ./src/build
WORKDIR ./src/build

COPY package*.json ./
COPY tsconfig.build.json ./

RUN if [ -z "$NPM_TOKEN" ]; then echo "NPM_TOKEN is not SET"; exit 1; else : ; fi

RUN printf "//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n" >> .npmrc && \
    npm cache verify && \
    npm install && \
    rm -f .npmrc

COPY ./scripts ./scripts
COPY ./openapi ./openapi
COPY ./prisma ./prisma
COPY ./src ./src
COPY ./bin ./bin

RUN npm run build

# Remove all unwanted dependancies
# and audit the modules to check for
# any invulnerabilities, this should fail
# upon finding one...
RUN npm prune --production && \
    npm audit

#####################################
#                                   #
#            Deployment             #
#                                   #
#####################################

FROM base

# Just to add something to healthcheck
ARG DOCKER_TAG
ARG SOURCE_BRANCH
ARG SOURCE_COMMIT

ENV DOCKER=true
ENV DOCKER_TAG=$DOCKER_TAG
ENV SOURCE_BRANCH=$SOURCE_BRANCH
ENV SOURCE_COMMIT=$SOURCE_COMMIT

ENV HOME=/usr/src/app
ENV PORT 3000

WORKDIR $HOME

COPY --from=build ./src/build/package*.json ./
COPY --from=build ./src/build/dist dist
COPY --from=build ./src/build/bin bin
COPY --from=build ./src/build/node_modules node_modules

USER node

EXPOSE $PORT

ENV NODE_ENV=production

CMD node bin/www.js --port $PORT
