FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TESSERACT_BINARY=tesseract \
    TESSERACT_LANGUAGES=rus+eng,eng

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      dumb-init \
      tesseract-ocr \
      tesseract-ocr-eng \
      tesseract-ocr-rus \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start"]
