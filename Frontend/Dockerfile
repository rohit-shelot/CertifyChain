# Stage 1: Build the Vite app
FROM node:22-alpine AS build

WORKDIR /app

# Render passes environment variables as ARGs to Docker
ARG VITE_CONTRACT_ADDRESS
ARG VITE_PINATA_JWT
ARG VITE_SEPOLIA_RPC

# Set them as ENV so Vite can read them during the build step
ENV VITE_CONTRACT_ADDRESS=$VITE_CONTRACT_ADDRESS
ENV VITE_PINATA_JWT=$VITE_PINATA_JWT
ENV VITE_SEPOLIA_RPC=$VITE_SEPOLIA_RPC

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]