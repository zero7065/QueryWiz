# Multi-stage production building Dockerfile for QueryWiz

# --- Build Stage ---
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependency configurations
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Run production build compilation for both UI and Express Backend
RUN npm run build

# --- Production Stage ---
FROM node:20-alpine AS runner
WORKDIR /app

# Ensure production environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only (saves heap memory and startup speed)
COPY package*.json ./
RUN npm install --only=production

# Copy compiled assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

# Start compiled server
CMD ["npm", "start"]
