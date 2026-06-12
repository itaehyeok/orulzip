FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV HOST=0.0.0.0

CMD ["npm", "run", "dev"]

