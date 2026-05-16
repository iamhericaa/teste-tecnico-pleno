# 🎨 Frontend — Investment Orders

Frontend responsivo em Next.js com integração completa ao backend em TypeScript.

## 🚀 Características

- ✅ **Lista de Ativos** — Visualiza todos os ativos com preço atual
- ✅ **Criar Ordem** — Modal para criar ordens de compra/venda
- ✅ **Lista de Ordens** — Histórico de ordens com status e ações
- ✅ **Carteira** — Posição consolidada com análise de rentabilidade
- ✅ **Design Verde & Branco** — Interface moderna com Tailwind CSS
- ✅ **Totalmente Responsiva** — Funciona em desktop, tablet e mobile

## 📋 Funcionalidades

### 1. Página Inicial - Ativos Disponíveis
- Lista todos os ativos do sistema
- Exibe preço atual de cada ativo
- Botão para criar ordem diretamente
- Grid responsivo (1 coluna mobile, 3 colunas desktop)

### 2. Modal de Criação de Ordem
- Seleção de tipo (Compra/Venda)
- Entrada de quantidade e preço
- Cálculo automático do valor total
- Validações em tempo real
- Feedback de sucesso/erro

### 3. Página de Ordens
- Lista todas as ordens do usuário
- Exibe status com cores diferentes
- Ícones para tipo de ordem (compra/venda)
- Botão para cancelar ordens pendentes
- Atualização manual com botão refresh

### 4. Página de Carteira
- Cards de resumo (valor total, ganho/perda, quantidade de ativos)
- Lista completa de posições ativas
- Quantidade, preço médio e preço atual
- Cálculo de ganho/perda por ativo
- Variação percentual

## 🛠️ Stack Tecnológico

- **Next.js 14** — Framework React
- **TypeScript** — Type safety
- **Tailwind CSS** — Styling
- **Axios** — HTTP client
- **App Router** — Roteamento moderno

## 📦 Instalação

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Passos

```bash
cd front-end
npm install
```

## 🚀 Execução

### Desenvolvimento
```bash
npm run dev
```

Acesse: `http://localhost:3000`

### Build para produção
```bash
npm run build
npm start
```

## 🔌 Integração com Backend

O frontend se conecta ao backend em `http://localhost:62000`.

Endpoints consumidos:

### Quotations
- `GET /quotations` — Lista todos os ativos
- `GET /quotations/:symbol` — Ativo específico

### Orders
- `POST /orders` — Criar ordem
- `GET /orders?userId=user-001` — Listar ordens
- `GET /orders/:id` — Detalhe da ordem
- `POST /orders/:id/cancel` — Cancelar ordem
- `POST /orders/:id/process` — Processar ordem

### Positions
- `GET /positions?userId=user-001` — Posições do usuário

## 🎨 Paleta de Cores

- **Primário (Verde)**: `#10B981` (`bg-primary`)
- **Secundário (Branco)**: `#FFFFFF`
- **Background**: `#F3F4F6` (cinza muito claro)

## 📁 Estrutura de Pastas

```
front-end/
├── app/
│   ├── page.tsx              # Página inicial (ativos)
│   ├── orders/
│   │   └── page.tsx          # Página de ordens
│   ├── positions/
│   │   └── page.tsx          # Página de carteira
│   ├── globals.css           # Estilos globais
│   └── layout.tsx            # Layout root
├── components/
│   ├── Navigation.tsx        # Navbar com navegação
│   ├── AssetList.tsx         # Lista de ativos
│   ├── CreateOrderModal.tsx  # Modal de criar ordem
│   ├── OrderList.tsx         # Lista de ordens
│   └── PositionList.tsx      # Lista de posições
├── lib/
│   └── api.ts                # Cliente HTTP
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## 🔐 Usuário Padrão

O frontend usa um usuário padrão para testes:
```
ID: user-001
Nome: João Investidor
```

Altere em `lib/api.ts` se necessário:

```typescript
const CURRENT_USER_ID = 'user-001';
```

## 🧪 Como Testar

### 1. Criar uma Ordem
1. Vá para "Ativos"
2. Clique em "Criar Ordem" em qualquer ativo
3. Preencha quantidade e preço
4. Clique em "Criar Ordem"

### 2. Cancelar uma Ordem
1. Vá para "Ordens"
2. Encontre uma ordem com status "PENDENTE"
3. Clique em "Cancelar Ordem"

### 3. Visualizar Carteira
1. Vá para "Carteira"
2. Veja valor total, ganho/perda e posições ativas

## 📱 Responsividade

O design é totalmente responsivo:

- **Mobile** (< 768px): 1 coluna
- **Tablet** (768px - 1024px): 2 colunas
- **Desktop** (> 1024px): 3 colunas

## 🐛 Troubleshooting

### Erro: "Cannot reach backend"
- Verifique se o backend está rodando em `http://localhost:62000`
- Verifique o CORS (se necessário, adicione middleware)

### Erro: "userId is required"
- Certifique-se que as requisições incluem `userId` (automático via `lib/api.ts`)

### Erro: "Saldo insuficiente"
- Você não tem quantidade suficiente do ativo
- Vá para "Carteira" para ver suas posições

## 📚 Variáveis de Ambiente

Crie um `.env.local` se necessário:

```env
NEXT_PUBLIC_API_URL=http://localhost:62000
```

E altere em `lib/api.ts`:

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:62000';
```

## 🚀 Deploy

### Vercel (Recomendado)
```bash
npm install -g vercel
vercel
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t investment-orders-frontend .
docker run -p 3000:3000 investment-orders-frontend
```

## 📈 Performance

- **Code Splitting**: Automático via Next.js
- **Image Optimization**: Próximas páginas carregam mais rápido
- **CSS Purging**: Tailwind remove CSS não usado
- **Minificação**: Build otimizado para produção

## 🔄 Atualizações Automáticas

Use `setInterval` em um hook customizado para atualizar dados em tempo real:

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    fetchOrders();
  }, 5000); // 5 segundos
  return () => clearInterval(interval);
}, []);
```

## 📝 Notas

- O frontend usa `user-001` por padrão
- Todas as datas são exibidas em formato local (pt-BR)
- Valores monetários são formatados com 2 casas decimais
- Status das ordens têm cores distintas para fácil visualização

---

**Desenvolvido com ❤️ usando Next.js + TypeScript + Tailwind CSS**
