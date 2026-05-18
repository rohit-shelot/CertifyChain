# Stage 1: Build the Vite (React) application
FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application for production
# Note: Ensure you have your environment variables set in Render
RUN npm run build

# Stage 2: Serve the application using Nginx
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy the build output from the first stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy our custom Nginx config for React Router
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 (Render automatically detects this)
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
