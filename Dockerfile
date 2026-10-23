FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm install
COPY . .
RUN npm run build
ENV HOST=0.0.0.0 PORT=8787 NODE_ENV=production
EXPOSE 8787
CMD ["npm", "start"]
