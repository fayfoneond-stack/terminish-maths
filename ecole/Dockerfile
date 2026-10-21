# Terminish École — image de production
# Node 22 est obligatoire : le serveur utilise le module natif `node:sqlite`.
FROM node:22-slim

ENV NODE_ENV=production \
    PORT=3000 \
    TERMINISH_DATA_DIR=/data

WORKDIR /app

# Dépendances d'abord (cache Docker), puis le code
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Dossier de données (base SQLite) : à monter sur un volume
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
