FROM node:20-alpine

WORKDIR /app

RUN npm install -g @expo/ngrok@^4.1.0

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 8081
EXPOSE 19000
EXPOSE 19001

CMD ["npm", "start", "--", "--tunnel"]