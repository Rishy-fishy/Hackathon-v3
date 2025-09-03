FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY src ./src
ENV NODE_ENV=production
EXPOSE 3002
CMD ["node","src/server.js"]
