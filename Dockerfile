FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production DB_PATH=/data/attendance.db PORT=3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
VOLUME /data
EXPOSE 3000
USER node
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
