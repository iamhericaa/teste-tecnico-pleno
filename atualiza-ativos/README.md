# atualiza-ativos

API TypeScript responsável por consumir `http://localhost:3001/quotations` a cada 1 segundo, salvar cotações no Redis e no banco de dados e permitir atualizações pontuais de ativos.

## Funcionamento

- Polling contínuo a `http://localhost:3001/quotations` a cada 1 segundo.
- Quando o endpoint responde `200`, os dados são salvos primeiro no Redis e depois no banco de dados.
- Em `502`, se o tempo de resposta ultrapassar 800ms, a operação é cancelada.
- Em `503` ou `504`, há retry com backoff exponencial: 1s, 2s e 4s, até 3 tentativas.
- Endpoint HTTP único:
  - `POST /assets` (atualiza todas as cotações à vista)
  - `POST /assets/:symbol` (atualiza apenas o ativo especificado)

## Variáveis de ambiente

- `PORT` - porta da API (default `4002`)
- `QUOTATIONS_URL` - URL base das cotações (default `http://localhost:3001/quotations`)
- `REDIS_URL` - conexão Redis (default `redis://localhost:6379`)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - configurações do MySQL

## Como usar

```bash
cd atualiza-ativos
npm install
npm run dev
```

Exemplo de uso do endpoint de atualização de ativo:

```bash
curl -X POST http://localhost:4002/assets/ITUB4
```
