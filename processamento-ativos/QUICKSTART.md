# Quickstart — Lambda local

Este diretório contém apenas o código da Lambda TypeScript que processa eventos SQS e a documentação mínima para executar localmente.

Pré-requisitos
- Node.js 20+
- Docker (opcional, para rodar um MySQL local)

Instalação

```bash
cd processamento-ativos
npm install
npx prisma generate
```

Preparar banco MySQL (opcional via Docker)

```bash
# Roda um MySQL local para testes
docker run --name local-mysql -e MYSQL_ROOT_PASSWORD=rootpassword -e MYSQL_USER=user -e MYSQL_PASSWORD=userpassword -e MYSQL_DATABASE=investment_orders -p 3306:3306 -d mysql:8.0

# Aplicar o schema (migrations)
npx prisma migrate deploy
```

Invocar a Lambda localmente

Coloque um evento SQS de exemplo em `body-conteudo-sqs.json` (já fornecido no workspace).

```bash
npm run local:invoke
```

O script `local:invoke` chama o handler em `src/index.ts` simulando um `SQSEvent` com o conteúdo de `body-conteudo-sqs.json`.

Estrutura mínima preservada

- `src/index.ts` — handler Lambda
- `src/services/OrderService.ts` — lógica de processamento
- `src/services/LoggerService.ts` — logger
- `src/services/SQSService.ts` — tipos da mensagem
- `src/types` — enums e tipos
- `prisma/schema.prisma` — modelagem do banco
- `src/local-invoke.ts` — utilitário para invocar localmente
- `QUICKSTART.md` — este arquivo

Problemas e notas

- Se houver erro de conexão com o MySQL, verifique se o container Docker está rodando e se `DATABASE_URL` aponta para `mysql://app_user:app_password@mysql:3306/investment_orders`.

---

Se quiser, eu adapto um `Dockerfile` específico para empacotar a Lambda ou adiciono um `template.yaml` do AWS SAM para facilitar invocações locais via `sam local invoke`.
