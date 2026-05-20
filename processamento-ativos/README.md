# processamento-ativos

Worker/Lambda em TypeScript responsavel por consumir mensagens SQS de ordens pendentes ou canceladas e aplicar o resultado no MySQL de forma transacional.

## O que este projeto faz

- Recebe eventos SQS com dados de ordens.
- Processa ordens `PENDENTE`.
- Cancela ordens com mensagem de status `CANCELADA`.
- Usa transacao serializable para evitar corrida entre consumidores.
- Faz claim atomico da ordem mudando `PENDENTE` para `PROCESSANDO`.
- Atualiza posicoes do usuario:
  - compra: cria ou incrementa posicao e recalcula preco medio;
  - venda: decrementa quantidade com condicao atomica de saldo suficiente.
- Finaliza ordens como `EXECUTADA`, `REJEITADA` ou `CANCELADA`.
- Possui poller local para simular consumo de SQS fora da AWS.

## Como executar com o ambiente completo

Na raiz do repositorio:

```bash
docker compose up -d --build
```

O container `lambda-processamento-ativos` sobe junto com o ambiente. Para logs:

```bash
docker compose logs -f lambda-processamento-ativos
```

No ambiente local do compose, o `poller.ts` e usado para buscar mensagens na fila do LocalStack e invocar o handler.

## Como executar localmente

```bash
cd processamento-ativos
npm install
npm run prisma:generate
npm run dev:poller
```

Variaveis principais:

```env
DATABASE_URL=mysql://app_user:app_password@localhost:3306/investment_orders
SQS_ENDPOINT=http://localhost:4566
SQS_QUEUE_NAME=orders-queue
AWS_REGION=sa-east-1
AWS_ACCESS_KEY_ID=teste
AWS_SECRET_ACCESS_KEY=teste
```

## Invocacao local sem fila

Edite o arquivo `body-conteudo-sqs.json` na raiz do repositorio com uma mensagem parecida com:

```json
{
  "orderId": 1,
  "userId": "user-001",
  "symbol": "ITUB4",
  "type": "COMPRA",
  "quantity": 10,
  "price": 32.8,
  "status": "PENDENTE",
  "timestamp": "2026-05-20T00:00:00.000Z"
}
```

Depois execute:

```bash
cd processamento-ativos
npm run local:invoke
```

## Scripts

```bash
npm run dev             # executa src/index.ts em dev
npm run dev:poller      # consome SQS local via poller
npm run build           # compila TypeScript
npm start               # executa dist/index.js
npm run start:poller    # executa dist/poller.js
npm run local:invoke    # simula um evento SQS usando body-conteudo-sqs.json
npm test                # roda testes Jest
npm run test:coverage   # roda testes com cobertura
npm run prisma:generate # gera Prisma Client
npm run prisma:migrate  # roda migrations em desenvolvimento
npm run prisma:studio   # abre Prisma Studio
```

## Testes

```bash
cd processamento-ativos
npm test
```

Os testes cobrem:

- processamento de ordem;
- transicoes de status;
- atualizacao de posicao;
- tratamento de mensagens duplicadas;
- handler Lambda com evento SQS.

## Padroes e decisoes importantes para entrevista

- Consumer de fila: desacopla execucao da ordem da API que criou a ordem.
- Idempotent Consumer: se uma mensagem duplicada chegar, o `updateMany` com status `PENDENTE` impede reprocessamento.
- Atomic Claim: a ordem é capturada ao mudar de `PENDENTE` para `PROCESSANDO` dentro da transacao.
- Unit of Work/Transaction Script: status da ordem e posicao sao atualizados na mesma transacao.
- Retry transacional: conflitos Prisma `P2034` sao tentados novamente ate o limite configurado.
- State Machine simples: fluxo passa por `PENDENTE`, `PROCESSANDO`, `EXECUTADA`, `REJEITADA` e `CANCELADA`.
- Consistencia: vendas usam decremento atomico com `quantity >= quantidade`, evitando saldo negativo.

## Estrutura principal

```text
src/
  index.ts                     # handler Lambda e factory createHandler
  poller.ts                    # consumidor local de SQS via LocalStack
  local-invoke.ts              # invocacao local sem SQS
  services/OrderService.ts     # regra transacional de processamento
  services/LoggerService.ts    # logger
  types/index.ts               # tipos da mensagem SQS
prisma/
  schema.prisma
  migrations/
```

## Pontos de atencao

- O processamento deve ser idempotente porque SQS trabalha com entrega pelo menos uma vez.
- O poller local so deve ser usado para desenvolvimento/teste local.
- Se uma ordem falhar durante o processamento, o servico tenta marca-la como `REJEITADA`.
- Cancelamento so altera ordens ainda cancelaveis (`PENDENTE` ou `PROCESSANDO`).
