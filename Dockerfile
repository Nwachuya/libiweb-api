FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application files used at runtime
COPY src/ ./src/
COPY pages/ ./pages/
COPY config/ ./config/
COPY public/ ./public/

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "src/index.js"]
