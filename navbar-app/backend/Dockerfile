FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --production && npm cache clean --force
COPY src ./src
ENV PORT=8080
EXPOSE 8080
CMD ["node","src/index.js"]
