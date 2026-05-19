# POC TypeScript + Express (OOP)

API simples de usuários usando abordagem orientada a objetos.

## Comandos

1. `npm install`
2. `npm run dev` (modo desenvolvimento)
3. `npm run build` + `npm start` (modo produção)

## Endpoints

- GET `/users` - lista usuários
- POST `/users` - cria usuário (body JSON: { name, email })
- GET `/users/:id` - retorna usuário
- PUT `/users/:id` - atualiza usuário
- DELETE `/users/:id` - exclui usuário

## Nota
Dados em memória (reiniciam ao parar o servidor), para estudo de fluxo OOP.
