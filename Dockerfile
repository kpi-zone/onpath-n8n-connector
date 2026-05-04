FROM n8nio/n8n:latest

USER root

# Copy only the essential files
COPY --chown=node:node dist/        /custom-node/onpath-n8n-connector/dist/
COPY --chown=node:node package.json /custom-node/onpath-n8n-connector/package.json

# Install the node globally so n8n can detect and load it automatically
RUN cd /custom-node/onpath-n8n-connector && npm install -g .

# Fix permissions
RUN chown -R node:node /home/node/.n8n

USER node
