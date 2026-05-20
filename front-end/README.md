# front-end

Aplicacao web em Next.js para consultar ativos, criar ordens, cancelar ordens pendentes e visualizar a carteira de um usuario.

## O que este projeto faz

- Lista cotacoes vindas da API `leitura-ativos`.
- Abre modal para criar ordem de compra ou venda.
- Envia a criacao de ordem para `criar-ordens-api`.
- Lista ordens do usuario selecionado.
- Permite cancelar ordens pendentes.
- Mostra posicoes da carteira com preco medio, preco atual e lucro/prejuizo.
- Permite alternar entre usuarios mockados: `user-001`, `user-002` e `user-003`.

## Como executar com o ambiente completo

Primeiro suba os backends na raiz do repositorio:

```bash
docker compose up -d --build
```

Depois execute o front-end:

```bash
cd front-end
npm install
npm run dev
```

Acesse:

```text
http://localhost:3000
```

## Variaveis de ambiente

Crie um `.env.local` se precisar mudar as URLs:

```env
NEXT_PUBLIC_LEITURA_API_URL=http://localhost:62000
NEXT_PUBLIC_ORDENS_API_URL=http://localhost:62001
```

Valores padrao usados pelo codigo:

- `NEXT_PUBLIC_LEITURA_API_URL`: `http://localhost:62000`
- `NEXT_PUBLIC_ORDENS_API_URL`: `http://localhost:62001`

## Scripts

```bash
npm run dev    # executa Next.js em desenvolvimento
npm run build  # gera build de producao
npm start      # executa build de producao
npm run lint   # roda lint do Next.js
```

## Telas e fluxos

- Home (`/`): lista ativos disponiveis e abre o modal de ordem.
- Ordens (`/orders`): exibe historico, status e acao de cancelamento.
- Carteira (`/positions`): exibe posicoes consolidadas do usuario.

Fluxo principal para demonstracao:

1. Subir os backends com Docker Compose.
2. Abrir `http://localhost:3000`.
3. Selecionar `user-001`.
4. Criar uma ordem de compra para um ativo disponivel.
5. Ir para a tela de ordens e acompanhar o status.
6. Consultar a carteira apos o processamento.

## Integracoes

O arquivo `lib/api.ts` funciona como uma facade para as APIs:

- `GET /quotations` em `leitura-ativos`;
- `GET /quotations/:symbol` em `leitura-ativos`;
- `GET /orders?userId=...` em `leitura-ativos`;
- `GET /orders/:id` em `leitura-ativos`;
- `GET /positions?userId=...` em `leitura-ativos`;
- `POST /criar-ordens` em `criar-ordens-api`;
- `POST /orders/:id/cancel` em `criar-ordens-api`.

## Testes e verificacao

Este projeto nao possui suite automatizada configurada no `package.json`.

```bash
npm run lint
npm run build
```

Depois valide no navegador:

- lista de ativos carrega;
- modal cria ordem com payload correto;
- tela de ordens lista a ordem criada;
- cancelamento funciona para ordem pendente;
- carteira exibe posicoes e valores calculados.

## Padroes e decisões importantes para entrevista

- Componentizacao React: telas compostas por `Navigation`, `AssetList`, `CreateOrderModal`, `OrderList` e `PositionList`.
- Custom Hook: `useSelectedUser` centraliza usuario selecionado e persiste em `localStorage`.
- Facade/API Client: `lib/api.ts` isola Axios, URLs e endpoints dos componentes.
- App Router do Next.js: rotas em `app/`, com paginas para ativos, ordens e carteira.
- Separacao entre leitura e escrita: o front consome `leitura-ativos` para consultas e `criar-ordens-api` para comandos.

## Estrutura principal

```text
app/
  page.tsx              # ativos
  orders/page.tsx       # ordens
  positions/page.tsx    # carteira
components/
  AssetList.tsx
  CreateOrderModal.tsx
  Navigation.tsx
  OrderList.tsx
  PositionList.tsx
lib/
  api.ts                # cliente HTTP
  useSelectedUser.ts    # usuario selecionado
```

## Troubleshooting

- Se ativos nao carregarem, verifique `http://localhost:62000/quotations`.
- Se criar ordem falhar, verifique `http://localhost:62001/health`.
- Se houver erro de CORS, confirme que as APIs Express estao rodando com o middleware configurado.
- Se a ordem ficar pendente, verifique logs de `lambda-processamento-ativos` e `localstack`.

*Última atualização: 20 maio de 2026.*