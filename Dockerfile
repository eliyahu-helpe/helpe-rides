FROM node:18
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN npm rebuild sqlite3
ENV PORT=80
EXPOSE 80

CMD ["npm", "start"]
