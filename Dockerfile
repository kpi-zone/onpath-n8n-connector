
FROM n8nio/n8n:latest

USER root

# Copy only the essential files (no node_modules, no source)
COPY --chown=node:node dist/        /custom-node/onpath-n8n-connector/dist/
COPY --chown=node:node package.json /custom-node/onpath-n8n-connector/package.json

# n8n uses pnpm internally — install the custom node into n8n's pnpm store
WORKDIR /usr/local/lib/node_modules/n8n
RUN pnpm install --save /custom-node/onpath-n8n-connector

# Switch back to the n8n default user
USER node
