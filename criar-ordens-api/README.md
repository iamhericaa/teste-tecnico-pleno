# Criar Ordens API

API para criação de ordens de investimento com processamento assíncrono.

## Funcionalidades

- **POST /criar-ordens**: Cria uma nova ordem de investimento
  - Busca saldo do usuário de forma assíncrona (mock)
  - Valida tipo da ordem (COMPRA ou VENDA)
  - Para COMPRA: valida se usuário tem saldo em dinheiro suficiente
  - Para VENDA: valida se usuário tem saldo do ativo suficiente
  - Utiliza o preço informado no payload (sem validação contra cotação de mercado)
  - Cria ordem no banco de dados com status PENDENTE
  - Envia mensagem para SQS com os dados da ordem

## Pré-requisitos

1. **Inicie o banco MySQL via Docker** (usando o docker-compose do leitura-ativos):
```bash
cd ../leitura-ativos
docker-compose up -d
```

2. **Aguarde o banco estar pronto** (cerca de 10-30 segundos)

## Instalação

```bash
cd criar-ordens-api
npm install

# O arquivo .env já está configurado com as credenciais do Docker
# Se precisar alterar, edite o arquivo .env

# Gere o cliente Prisma
npm run prisma:generate

# Opção 1: Usando usuário root para migrations (tem permissões)
DATABASE_URL="mysql://root:rootpassword@localhost:3306/investment_orders" npm run prisma:migrate

# Ou Opção 2: Se já tiver as tabelas criadas no leitura-ativos, só precisa gerar o cliente
# npm run prisma:generate já é suficiente
```

## Execução

### 🐳 Modo Docker (Recomendado)
Inicia MySQL e a API em containers:

```bash
# Build e inicia os containers
docker-compose up -d --build

# Acompanhar os logs
docker-compose logs -f api

# Para parar os containers
docker-compose down
```

A API estará disponível em: `http://localhost:62001`

### Modo Desenvolvimento (local)
```bash
# Altere o DATABASE_URL no .env para @localhost
# DATABASE_URL="mysql://app_user:app_password@localhost:3306/investment_orders"

npm run dev
```

### Modo Produção
```bash
npm run build
npm start
```

## Endpoints

### POST /criar-ordens
Cria uma nova ordem de investimento.

**Request Body:**
```json
{
  "userId": "user-001",
  "symbol": "ITUB4",
  "type": "COMPRA",
  "quantity": 10,
  "price": 32.80
}
```

**Response (Sucesso):**
```json
{
  "success": true,
  "message": "Ordem criada com sucesso",
  "orderId": 1,
  "status": "PENDENTE"
}
```

**Response (Erro - Saldo Insuficiente):**
```json
{
  "success": false,
  "message": "Saldo insuficiente para compra. Necessário: R$ 5000.00",
  "status": "REJEITADA"
}
```

**Response (Erro - Saldo do Ativo Insuficiente):**
```json
{
  "success": false,
  "message": "Saldo insuficiente do ativo ITUB4 para venda. Necessário: 200",
  "status": "REJEITADA"
}
```

### GET /ordens/:id
Busca uma ordem por ID.

**Response:**
```json
{
  "id": 1,
  "user_id": "user-001",
  "symbol": "ITUB4",
  "type": "COMPRA",
  "quantity": 10,
  "price": 32.80,
  "status": "PENDENTE",
  "created_at": "2026-04-28T21:00:00.000Z",
  "updated_at": "2026-04-28T21:00:00.000Z"
}
```

### GET /ordens?userId=user-001
Lista ordens de um usuário.

**Response:**
```json
[
  {
    "id": 1,
    "user_id": "user-001",
    "symbol": "ITUB4",
    "type": "COMPRA",
    "quantity": 10,
    "price": 32.80,
    "status": "PENDENTE",
    "created_at": "2026-04-28T21:00:00.000Z",
    "updated_at": "2026-04-28T21:00:00.000Z"
  }
]
```

### GET /health
Health check da API.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2026-04-28T21:00:00.000Z"
}
```

## Mock de Dados

### Usuários e Saldos

| Usuário | Saldo em Dinheiro | Ativos |
|---------|-------------------|--------|
| user-001 | R$ 10.000,00 | ITUB4: 100, USDC: 50, PETR4: 200 |
| user-002 | R$ 5.000,00 | BTC: 0.1, ETH: 2.5 |
| user-003 | R$ 500,00 | VALE3: 10 |

### Ativos e Preços

| Símbolo | Preço |
|---------|-------|
| ITUB4 | R$ 32,80 |
| ITUB3 | R$ 15,40 |
| USDC | R$ 5,50 |
| SOL | R$ 418,07 |
| BTC | R$ 350.000,00 |
| ETH | R$ 18.500,00 |
| PETR4 | R$ 38,50 |
| VALE3 | R$ 68,90 |

## Fluxo de Processamento

1. **Recebimento da requisição**: Validação inicial dos campos obrigatórios
2. **Busca de saldo**: Consulta assíncrona do saldo do usuário
3. **Validação**:
   - COMPRA: Verifica se `saldo_em_dinheiro >= quantidade * preco`
   - VENDA: Verifica se `saldo_do_ativo >= quantidade`
4. **Criação da ordem**: Se validação passar, cria ordem com status `PENDENTE`
5. **Envio para SQS**: Envia mensagem com dados da ordem para fila

## Variáveis de Ambiente

| Variável | Descrição | Exemplo |
|----------|-----------|--------|
| PORT | Porta do servidor | 62001 |
| DATABASE_URL | URL de conexão com o banco (Prisma) | mysql://app_user:app_password@localhost:3306/investment_orders |
| SQS_QUEUE_NAME | Nome da fila SQS | orders-queue |

## Tecnologias

- **Node.js** + **TypeScript**
- **Express** - Framework HTTP
- **Prisma** - ORM para banco de dados
- **MySQL** - Banco de dados
- **AWS SDK** - Cliente SQS (mock)
