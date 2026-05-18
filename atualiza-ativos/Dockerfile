# Usando imagem Node.js Debian (compatível com Prisma)
FROM node:20-bookworm-slim

# Instalar dependências do sistema necessárias para Prisma
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar todo o código
COPY . .

# Compilar TypeScript
RUN npm run build

# Expor a porta da API
EXPOSE 62002

# Comando para iniciar a aplicação
CMD ["npm", "start"]
