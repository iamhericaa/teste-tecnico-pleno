# Usando imagem Node.js Debian (compatível com Prisma)
FROM node:20-bookworm-slim

# Definir diretório de trabalho
WORKDIR /app

# Dependências necessárias para o Prisma em imagens slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm ci

# Copiar todo o código
COPY . .

# Gerar o cliente Prisma
RUN npx prisma generate

# Compilar TypeScript
RUN npm run build

# Expor a porta da API
EXPOSE 62000

CMD ["npm", "run", "start"]
