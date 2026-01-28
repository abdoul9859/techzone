# Node image for whatsapp-web.js gateway
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
# Install git and Chromium dependencies for Puppeteer and whatsapp-web.js
RUN apk add --no-cache \
    git \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    wget \
    curl \
    && npm install --only=production || npm install --only=production

# Tell Puppeteer to use the installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
COPY server.js ./
# Persist session between restarts
VOLUME ["/app/session"]
ENV PORT=3002
EXPOSE 3002
CMD ["node", "server.js"]
