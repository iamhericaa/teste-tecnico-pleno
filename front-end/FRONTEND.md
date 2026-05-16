# 🎨 Frontend Investment Orders — Guia Completo

## 📖 Visão Geral

Frontend moderno em Next.js 14 com TypeScript, Tailwind CSS e design responsivo em cores verde e branco. Integrado completamente ao backend Express em `http://localhost:62000`.

---

## ✨ Funcionalidades Implementadas

### 1. 📈 Lista de Ativos (Página Inicial)
- Fetch automático de todos os ativos do backend
- Exibe símbolo, nome e preço de referência
- Grid responsivo (1-2-3 colunas conforme tamanho da tela)
- Botão para criar ordem em cada ativo
- Loading state e tratamento de erro

### 2. 🔐 Modal de Criação de Ordem
- Tipo de ordem: COMPRA ou VENDA
- Input de quantidade e preço
- Cálculo automático do valor total
- Validações em tempo real
- Toast/alert de sucesso ou erro
- Integração completa com backend

### 3. 📋 Lista de Ordens
- Fetch de todas as ordens do usuário (user-001)
- Exibe: ID, símbolo, tipo, quantidade, preço, status
- Status com cores distintas:
  - Amarelo: PENDENTE
  - Azul: PROCESSANDO
  - Verde: EXECUTADA
  - Vermelho: REJEITADA
  - Cinza: CANCELADA
- Ícones visuais (📈 compra, 📉 venda)
- Botão para cancelar ordens PENDENTE
- Atualização manual com botão refresh
- Loading state e tratamento de erro

### 4. 💼 Carteira do Usuário
- Cards de resumo:
  - Valor total da carteira (verde)
  - Ganho/Perda total (verde se positivo, vermelho se negativo)
  - Quantidade de ativos
- Lista detalhada de posições:
  - Nome e símbolo do ativo
  - Quantidade
  - Preço médio de compra
  - Preço atual
  - Valor total
  - Ganho/Perda total
  - Variação percentual
- Apenas ativos com quantidade > 0 são exibidos
- Ordenado por valor total (maior para menor)
- Atualização manual com botão refresh

---

## 🎨 Design & UX

### Paleta de Cores
- **Verde Primário**: `#10B981` (botões, headers, destaques)
- **Branco**: `#FFFFFF` (cards, fundo)
- **Cinza Claro**: `#F3F4F6` (fundo geral)
- **Cinza Escuro**: `#1F2937` (texto principal)

### Componentes Reutilizáveis
- `Navigation` — Navbar fixa com links para as 3 páginas
- `AssetList` — Grid de ativos com botões
- `CreateOrderModal` — Modal para criar ordens
- `OrderList` — Lista de ordens com status
- `PositionList` — Carteira com resumo e detalhes

### Responsividade
```css
/* Mobile First */
- 1 coluna por padrão
md: (768px+) — 2 colunas
lg: (1024px+) — 3 colunas
```

---

## 🚀 Como Rodar

### 1. Instalar Dependências

```bash
# Na raiz do projeto
cd front-end
npm install
```

### 2. Verificar Variáveis de Ambiente

O frontend espera que o backend esteja em `http://localhost:62000`.

Se precisar alterar, edite `lib/api.ts`:
```typescript
const API_BASE_URL = 'http://localhost:62000';
```

### 3. Iniciar em Desenvolvimento

```bash
npm run dev
```

Acesse: **http://localhost:3000**

### 4. Build para Produção

```bash
npm run build
npm start
```

---

## 📁 Estrutura de Arquivos

```
front-end/
│
├── app/
│   ├── page.tsx                  # Página inicial (ativos)
│   ├── orders/
│   │   └── page.tsx              # Página de ordens
│   ├── positions/
│   │   └── page.tsx              # Página de carteira
│   ├── layout.tsx                # Layout raiz (head, body)
│   └── globals.css               # Estilos globais
│
├── components/
│   ├── Navigation.tsx            # Navbar sticky
│   ├── AssetList.tsx             # Grid de ativos
│   ├── CreateOrderModal.tsx      # Modal com form
│   ├── OrderList.tsx             # Lista de ordens
│   └── PositionList.tsx          # Carteira com summary
│
├── lib/
│   └── api.ts                    # Cliente Axios + endpoints
│
├── package.json                  # Dependências
├── tsconfig.json                 # Configuração TypeScript
├── tailwind.config.ts            # Configuração Tailwind
├── postcss.config.js             # Configuração PostCSS
├── next.config.js                # Configuração Next.js
└── README.md                     # Documentação
```

---

## 🔌 Integração com Backend

### Endpoints Consumidos

#### GET /quotations
```typescript
const assets = await api.getQuotations();
// Retorna: Array<{symbol, name, reference_price, created_at, updated_at}>
```

#### POST /orders
```typescript
await api.createOrder({
  symbol: 'ITUB4',
  type: 'COMPRA',
  quantity: 10,
  price: 32.80
});
// Retorna: Order com id, status PENDENTE, etc
```

#### GET /orders?userId=user-001
```typescript
const orders = await api.getOrders();
// Retorna: Array<Order>
```

#### GET /orders/:id
```typescript
const order = await api.getOrder(1);
// Retorna: Order específica
```

#### POST /orders/:id/cancel
```typescript
await api.cancelOrder(1);
// Retorna: Order com status CANCELADA
```

#### GET /positions?userId=user-001
```typescript
const positions = await api.getPositions();
// Retorna: Array<PositionWithAsset>
```

---

## 🧪 Fluxo de Teste Completo

### 1. Listar Ativos
- Vá para "Ativos"
- Veja grid com todos os 6 ativos
- Cada ativo mostra símbolo, nome e preço

### 2. Criar Ordem de Compra
- Clique "Criar Ordem" em ITUB4
- Modal abre com ITUB4 pré-selecionado
- Digite quantidade: 5
- Preço já está preenchido com reference_price
- Clique "Criar Ordem"
- ✅ Ordem criada com status PENDENTE

### 3. Visualizar Ordem
- Vá para "Ordens"
- Veja a ordem que acabou de criar
- Status deve ser PENDENTE (amarelo)
- Mostra ID, símbolo, tipo, quantidade

### 4. Cancelar Ordem
- Na página "Ordens", encontre a ordem PENDENTE
- Clique "Cancelar Ordem"
- ✅ Status muda para CANCELADA

### 5. Visualizar Carteira
- Vá para "Carteira"
- Veja cards de resumo (valor total, ganho/perda)
- Lista de posições ativas
- Cada posição mostra: quantidade, preço médio, preço atual, variação %

---

## 🎯 Estados & Loading

### AssetList
- ⏳ Loading — "Carregando ativos..."
- ❌ Error — Mensagem de erro + botão retry
- ✅ Success — Grid de ativos

### CreateOrderModal
- 📝 Preenchimento — Inputs abertos
- ⏳ Loading — "Criando..." no botão
- ❌ Error — Mensagem inline no modal
- ✅ Success — Modal fecha, ordem listada

### OrderList
- ⏳ Loading — "Carregando ordens..."
- 📭 Empty — "Nenhuma ordem criada ainda"
- ❌ Error — Mensagem + botão retry
- ✅ Success — Lista de ordens

### PositionList
- ⏳ Loading — "Carregando posições..."
- 📭 Empty — "Nenhuma posição ativa"
- ❌ Error — Mensagem + botão retry
- ✅ Success — Cards de resumo + lista de posições

---

## 🔐 Autenticação

O frontend usa `user-001` como usuário fixo. Todas as operações usam este ID.

Para integrar com autenticação real:

1. Adicione um contexto de autenticação
2. Altere `CURRENT_USER_ID` dinamicamente
3. Implemente login/logout

---

## 📱 Breakpoints Tailwind

| Breakpoint | Tamanho | Colunas |
|-----------|---------|---------|
| sm | 640px | 1 |
| md | 768px | 2 |
| lg | 1024px | 3 |
| xl | 1280px | 3 |

---

## 🐛 Troubleshooting

### "Cannot read properties of undefined (reading 'map')"
- Backend não está respondendo
- Verifique `http://localhost:62000`
- Inicie o backend com `npm run dev` em `leitura-ativos`

### "404: Not Found"
- Rota não existe
- Verifique se você está em `http://localhost:3000`

### "userId is required"
- Header ou query param missing
- Verifique `lib/api.ts` está correto

### Ordem não aparece na lista
- Clique botão "🔄 Atualizar"
- Verifique console do navegador para erros

### Estilos não carregam (tudo cinza)
- Rode `npm install` novamente
- Delete pasta `.next` e `npm run dev` de novo
- Verifi que Tailwind está configurado

---

## 🚀 Deploy

### Vercel
```bash
npm install -g vercel
vercel
```

### Netlify
```bash
npm run build
# Faça deploy da pasta .next
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 📊 Performance

- **LCP (Largest Contentful Paint)**: < 2.5s
- **FID (First Input Delay)**: < 100ms
- **CLS (Cumulative Layout Shift)**: < 0.1

### Otimizações
- Code splitting automático
- Image optimization (Next.js)
- CSS purging (Tailwind)
- Minificação (build production)

---

## 📚 Dependências

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "next": "14",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10",
    "postcss": "^8",
    "tailwindcss": "^3",
    "eslint": "^8",
    "eslint-config-next": "14"
  }
}
```

---

## 🎓 Aprendizados & Decisões

### Por que Next.js?
- ✅ Full-stack React
- ✅ Server-side rendering (SSR) opcional
- ✅ API routes (se necessário)
- ✅ Otimização automática
- ✅ Deployabillidade

### Por que Tailwind?
- ✅ Utility-first CSS
- ✅ Responsivo nativo
- ✅ Cores customizáveis
- ✅ Sem dependência de componentes UI
- ✅ Arquivo CSS pequeno (purging)

### Por que Axios?
- ✅ Simples e intuitivo
- ✅ Interceptadores automáticos
- ✅ Cancelamento de requisições
- ✅ Timeout nativo

---

## ✅ Checklist de Funcionalidades

- [x] Lista de ativos
- [x] Criar ordem (modal com form)
- [x] Listar ordens com status
- [x] Cancelar ordem pendente
- [x] Visualizar carteira/posições
- [x] Design verde e branco
- [x] Responsivo (mobile/tablet/desktop)
- [x] Loading states
- [x] Error handling
- [x] TypeScript completo
- [x] Integração com backend

---

**Desenvolvido com ❤️ usando Next.js 14 + TypeScript + Tailwind CSS**
