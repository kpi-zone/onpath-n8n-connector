FROM n8nio/n8n:latest

USER root

# Place the custom node outside the n8n-data volume mount
# so the host volume doesn't override it
RUN mkdir -p /custom-node/node_modules/onpath

COPY --chown=node:node dist/        /custom-node/node_modules/onpath/dist/
COPY --chown=node:node package.json /custom-node/node_modules/onpath/package.json

RUN chown -R node:node /custom-node

USER node
