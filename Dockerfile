FROM n8nio/n8n:latest

USER root

# Copy only the essential files (no node_modules, no source)
COPY --chown=node:node dist/        /custom-node/onpath-n8n-connector/dist/
COPY --chown=node:node package.json /custom-node/onpath-n8n-connector/package.json

# Install production dependencies for the custom node
WORKDIR /custom-node/onpath-n8n-connector
RUN npm install --production

# Switch back to the n8n default user
USER node
