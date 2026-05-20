# criar-ordens-api

API em TypeScript/Express responsavel por receber ordens de compra e venda, validar dados iniciais, criar a ordem no MySQL e publicar a mensagem no SQS para processamento assincrono.

## O que este projeto faz

- Expoe endpoint para criacao de ordens.
- Valida payload obrigatorio, tipo da ordem e valores positivos.
- Consulta saldo mockado do usuario antes de aceitar a ordem.
- Para compra, valida dinheiro disponivel.
- Para venda, valida quantidade do ativo disponivel no mock.
- Cria ordens `PENDENTE` ou `REJEITADA` no MySQL.
- Publica ordens pendentes na fila SQS `orders-queue`.
- Permite cancelar ordens pelo endpoint de cancelamento.

## Como executar com o ambiente completo

Na raiz do repositorio:

```bash
docker compose up -d --build
```

A API fica disponivel em:

```text
http://localhost:62001
```

Health check:

```bash
curl http://localhost:62001/health
```

Logs:

```bash
docker compose logs -f api-criar-ordens
```

## Como executar localmente

Suba MySQL e LocalStack pela raiz do repositorio ou use o `docker compose` completo. Depois:

```bash
cd criar-ordens-api
npm install
npm run prisma:generate
npm run dev
```

Variaveis principais:

```env
PORT=62001
DATABASE_URL=mysql://app_user:app_password@localhost:3306/investment_orders
SQS_QUEUE_NAME=orders-queue
SQS_ENDPOINT=http://localhost:4566
AWS_REGION=sa-east-1
AWS_ACCESS_KEY_ID=teste
AWS_SECRET_ACCESS_KEY=teste
```

## Endpoints

### GET /health

```bash
curl http://localhost:62001/health
```

### POST /criar-ordens

```bash
curl -X POST http://localhost:62001/criar-ordens \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"user-001\",\"symbol\":\"ITUB4\",\"type\":\"COMPRA\",\"quantity\":10,\"price\":32.8}"
```

Resposta de sucesso:

```json
{
  "success": true,
  "message": "Ordem criada com sucesso",
  "orderId": 1,
  "status": "PENDENTE"
}
```

Resposta de validacao:

```json
{
  "success": false,
  "message": "Saldo insuficiente para compra. Necessario: R$ 5000.00",
  "status": "REJEITADA"
}
```

### POST /orders/:id/cancel

```bash
curl -X POST http://localhost:62001/orders/1/cancel
```

## Usuarios mockados

| Usuario | Dinheiro | Ativos |
| --- | ---: | --- |
| `user-001` | 10000.00 | `ITUB4: 100`, `USDC: 50`, `PETR4: 200` |
| `user-002` | 5000.00 | `BTC: 0.1`, `ETH: 2.5` |
| `user-003` | 500.00 | `VALE3: 10` |

## Scripts

```bash
npm run dev             # executa em desenvolvimento
npm run build           # compila TypeScript
npm start               # executa dist/index.js
npm test                # roda testes Jest
npm run test:coverage   # roda testes com cobertura
npm run prisma:generate # gera Prisma Client
npm run prisma:migrate  # roda migrations em desenvolvimento
npm run prisma:studio   # abre Prisma Studio
```

## Testes

```bash
cd criar-ordens-api
npm test
```

Os testes cobrem:

- `OrderController`;
- validacoes de ordem;
- `OrderService`;
- `BalanceService`;
- `QuotationService`;
- publicacao no SQS;
- integracao da API Express.

## Padroes e decisões importantes

- Layered Architecture: controller trata HTTP; services concentram regras de negocio e integracoes.
- Producer/Consumer: a API apenas cria e publica a ordem; a execucao real ocorre no `processamento-ativos`.
- Dependency Injection simples: controllers recebem services no construtor, facilitando testes.
- Fail fast no controller: payload invalido nem chega ao fluxo de persistencia.
- Processamento assincrono: melhora tempo de resposta e desacopla criacao de execucao.
- Status de dominio: a ordem nasce `PENDENTE`, pode ser `REJEITADA`, `CANCELADA` ou depois `EXECUTADA`.

## Estrutura principal

```text
src/
  app.ts                         # configura Express, CORS, rotas e logging HTTP
  index.ts                       # inicia servidor
  controllers/OrderController.ts # camada HTTP
  services/OrderService.ts       # regra de criacao/cancelamento
  services/BalanceService.ts     # saldo mockado para validacao
  services/SQSService.ts         # publicacao na fila
  types/                         # contratos e tipos da API
prisma/
  schema.prisma                  # schema compartilhado de banco
```

## Pontos de atencao

- O saldo usado na criacao e mockado, suficiente para demonstrar validacao de negocio.
- A ordem pendente e enviada ao SQS, entao o status final deve ser consultado na API `leitura-ativos`.
- LocalStack simula SQS localmente no `docker-compose.yml`.


*Última atualização: 20 maio de 2026.*