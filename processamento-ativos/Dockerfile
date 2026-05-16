FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl netcat-openbsd

COPY package*.json ./
RUN npm ci

# Copia só o schema para gerar o client no ambiente correto
COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN npm run build

# Compila TypeScript
RUN npm run build

# Script para aguardar o banco de dados ficar pronto (APENAS PARA LOCAL INTEGRADO)
RUN printf '%s\n' '#!/bin/sh' 'set -e' 'host="$1"' 'port="${2:-3306}"' 'shift 2' 'cmd="$@"' '' 'echo "[wait-for-db] Aguardando banco em $host:$port..."' 'until nc -z "$host" "$port" 2>/dev/null; do' '  echo "[wait-for-db] Banco não está pronto, aguardando..."' '  sleep 2' 'done' '' 'echo "[wait-for-db] ✅ Banco pronto! Iniciando poller..."' 'exec $cmd' > /app/wait-for-db.sh \
  && chmod +x /app/wait-for-db.sh

# Por padrão, executa o poller local (APENAS PARA AMBIENTE LOCAL INTEGRADO)
# Aguarda o banco ficar pronto antes de iniciar
CMD ["/app/wait-for-db.sh", "mysql", "3306", "npm", "run", "start:poller"]
