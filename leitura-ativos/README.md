# leitura-ativos

API em TypeScript/Express responsavel por consultas do sistema: cotacoes, ordens e posicoes de carteira. Ela e a camada de leitura usada pelo front-end.

## O que este projeto faz

- Lista cotacoes de ativos.
- Busca cotacao por simbolo.
- Lista ordens de um usuario.
- Busca uma ordem por ID.
- Lista posicoes de carteira de um usuario.
- Busca cotacoes no Redis primeiro e usa MySQL como fallback quando o Redis falha.
- Calcula lucro/prejuizo das posicoes com base no preco atual.

## Como executar com o ambiente completo

Na raiz do repositorio:

```bash
docker compose up -d --build
```

A API fica disponivel em:

```text
http://localhost:62000
```

Logs:

```bash
docker compose logs -f api-leitura-ativos
```

## Como executar localmente

Suba MySQL e Redis pela raiz do repositorio ou use o Docker Compose completo. Depois:

```bash
cd leitura-ativos
npm install
npm run dev
```

Variaveis principais:

```env
DATABASE_URL=mysql://app_user:app_password@localhost:3306/investment_orders
REDIS_URL=redis://localhost:6379
PORT=62000
```

Observacao: o arquivo `src/index.ts` usa porta `62000` fixa no codigo.

## Endpoints

### GET /

Health check simples:

```bash
curl http://localhost:62000/
```

### GET /quotations

```bash
curl http://localhost:62000/quotations
```

### GET /quotations/:symbol

```bash
curl http://localhost:62000/quotations/ITUB4
```

### GET /orders?userId=...

```bash
curl "http://localhost:62000/orders?userId=user-001"
```

### GET /orders/:id

```bash
curl http://localhost:62000/orders/1
```

### GET /positions?userId=...

```bash
curl "http://localhost:62000/positions?userId=user-001"
```

## Scripts

```bash
npm run dev            # executa em desenvolvimento
npm run build          # compila TypeScript
npm start              # executa dist/index.js
npm test               # roda testes Jest
npm run test:coverage  # roda testes com cobertura
```

## Testes

```bash
cd leitura-ativos
npm test
```

Os testes cobrem:

- controllers de cotacoes, ordens e posicoes;
- services de leitura;
- fallback Redis -> MySQL;
- integracao da API Express.

## Padroes e decisões importantes para entrevista

- Layered Architecture: controllers lidam com HTTP; services lidam com regra de leitura e acesso a dados.
- Cache-Aside/Fallback: `QuotationService` tenta Redis primeiro e recorre ao banco quando ha erro.
- Adapter/Mapper: os dados de Prisma e Redis sao mapeados para o formato de resposta da API.
- Dependency Injection simples: services e controllers aceitam dependencias no construtor, facilitando mocks.
- Read Model: esta API concentra consultas, separada da API de comandos `criar-ordens-api`.
- Observabilidade: middleware de log registra metodo, path e parametros de query.

## Estrutura principal

```text
src/
  app.ts                              # configura Express, CORS, rotas e logging
  index.ts                            # inicia servidor na porta 62000
  controllers/
    QuotationController.ts
    OrderController.ts
    PositionController.ts
  services/
    QuotationService.ts               # Redis primeiro, MySQL como fallback
    OrderService.ts                   # consulta ordens e processamento legado
    PositionService.ts                # consulta carteira e calcula P/L
  database/
    prisma.ts                         # Prisma Client compartilhado
    redis.ts                          # cliente Redis para cotacoes
```

## Pontos de atencao

- O Redis armazena a ultima cotacao em chaves como `asset:ITUB4:latest`.
- Tambem ha suporte a chaves seedadas como `price:ITUB4`.
- Se Redis estiver fora, a API ainda consulta MySQL para manter disponibilidade de leitura.
- Posicoes sao retornadas apenas quando `quantity > 0`.


*Última atualização: 20 maio de 2026.*
