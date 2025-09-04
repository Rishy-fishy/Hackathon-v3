FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY src ./src
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node","src/server.js"]
