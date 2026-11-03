# Multi-Stage Build for StormSentinel Frontend
# Stage 1: Build the Vite + React TypeScript bundle
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Serve production assets with Nginx
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built bundle from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
