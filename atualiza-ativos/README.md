# atualiza-ativos

API TypeScript responsavel por consumir `http://localhost:3001/quotations`, salvar cotacoes no Redis a cada 1 segundo, salvar no banco de dados a cada 10 segundos e permitir atualizacoes pontuais de ativos.

## Funcionamento

- Polling continuo a `http://localhost:3001/quotations` para Redis a cada 1 segundo.
- Polling para banco de dados a cada 10 segundos por padrao.
- Quando o endpoint responde `200`, os dados sao salvos no destino do ciclo atual.
- Em `502`, se o tempo de resposta ultrapassar 800ms, a operacao e cancelada.
- Em `503` ou `504`, ha retry com backoff exponencial: 1s, 2s e 4s, ate 3 tentativas.
- Endpoint HTTP unico:
  - `POST /assets` atualiza todas as cotacoes a vista.
  - `POST /assets/:symbol` atualiza apenas o ativo especificado.

## Variaveis de ambiente

- `PORT` - porta da API (default `4002`)
- `QUOTATIONS_URL` - URL base das cotacoes (default `http://localhost:3001/quotations`)
- `POLL_INTERVAL_MS` - intervalo de salvamento no Redis (default `1000`)
- `DB_POLL_INTERVAL_MS` - intervalo de salvamento no banco de dados (default `10000`)
- `REDIS_URL` - conexao Redis (default `redis://localhost:6379`)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - configuracoes do MySQL

## Como usar

```bash
cd atualiza-ativos
npm install
npm run dev
```

Exemplo de uso do endpoint de atualizacao de ativo:

```bash
curl -X POST http://localhost:4002/assets/ITUB4
```
