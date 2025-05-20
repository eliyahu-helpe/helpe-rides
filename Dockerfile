FROM node:18
RUN apt-get update && apt-get install -y \
    chromium \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libxcomposite1 \
    libxrandr2 \
    libxdamage1 \
    libxkbcommon0 \
    libpango-1.0-0 \
    libgbm1 \
    libasound2 \
    cron \
    curl \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

USER root

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

RUN npm rebuild sqlite3
RUN echo -e "#!/bin/bash\n\ncurl -X GET http://localhost/help-center/set-html-content\n\ncurl -X GET http://localhost/updateDb" > /usr/local/bin/helpe_rides.sh
RUN chmod +x /usr/local/bin/helpe_rides.sh
RUN echo "0 2 * * * /usr/local/bin/helpe_rides.sh >> /var/log/cron.log 2>&1" > /etc/cron.d/api-cron-job
ENV PORT=80
ENV NODE_ENV="production"
EXPOSE 80

CMD ["npm", "start"]