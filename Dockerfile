FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY src/ ./src/

# State file lives in a mounted volume so it persists across restarts
VOLUME ["/app/data"]
ENV STATE_FILE=/app/data/bot-state.json

# Never run as root
RUN addgroup -S botgroup && adduser -S botuser -G botgroup
USER botuser

CMD ["node", "src/index.js"]
