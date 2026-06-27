FROM node:18-alpine AS frontend-build

WORKDIR /frontend

ARG VITE_CONTRACT_ADDRESS
ARG VITE_SEPOLIA_RPC

ENV VITE_CONTRACT_ADDRESS=$VITE_CONTRACT_ADDRESS
ENV VITE_SEPOLIA_RPC=$VITE_SEPOLIA_RPC

COPY Frontend/package*.json ./
RUN npm ci

COPY Frontend/ ./
RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY Backend/package*.json ./
RUN npm ci --omit=dev

COPY Backend/server.js ./
COPY --from=frontend-build /frontend/dist ./public

EXPOSE 3001

CMD ["node", "server.js"]