# Sistema de Ordens de Ativos

Sistema para criação, processamento e consulta de ordens de compra e venda de ativos. A solução separa leitura, criação de ordens, processamento assíncrono e atualização de cotações, usando MySQL, Redis e SQS para simular um ambiente distribuído.

---

## Sumário

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Serviços](#serviços)
4. [Design Patterns](#design-patterns)
5. [Fluxo de Compra e Venda](#fluxo-de-compra-e-venda)
6. [Testes](#testes)
7. [Observabilidade e Dashboards](#observabilidade-e-dashboards-propostos)
8. [SLOs e Error Budget](#slos-e-error-budget)
9. [Como Rodar Localmente](#como-rodar-localmente)

---

## Visão Geral

O sistema processa ordens de compra e venda de ativos financeiros. A arquitetura separa responsabilidades em quatro serviços, cada um com um papel claro no fluxo da ordem.

**Decisões arquiteturais principais:**

- **Ordens assíncronas via SQS** — a API responde com `PENDENTE`; o processamento ocorre em uma Lambda acionada pela fila.
- **Cache-aside com Redis** — cotações e posições são buscadas primeiro no Redis; em caso de falha, a leitura cai para o banco relacional.
- **Idempotência por atomic claim** — o processador usa `updateMany` atômico para evitar execução duplicada em re-entregas do SQS.
- **Horário comercial isolado** — `criar-ordens-api` pode ser executado apenas em horário comercial; `leitura-ativos` permanece disponível para consultas.

---

## Arquitetura

```
Cliente / Front-end
       │
       ├──► leitura-ativos API (ECS 24/7)
       │         ├── Redis / ElastiCache  ◄── cache-aside
       │         └── MySQL (fallback)
       │
       └──► criar-ordens-api (ECS horário comercial)
                 ├── MySQL (valida + persiste PENDENTE)
                 └── Amazon SQS ──► processamento-ativos (Lambda)
                                          ├── MySQL (executa transação)
                                          └── Redis (atualiza cache)

atualiza-ativos (Worker ECS)
       ├── Serviço externo de cotações
       ├── Redis (atualiza preços)
       └── MySQL (persiste histórico)
```

### Infraestrutura AWS

| Componente | Serviço AWS |
|---|---|
| APIs e Workers | ECS (Fargate) |
| Processamento de ordens | AWS Lambda |
| Fila de mensagens | Amazon SQS |
| Cache | ElastiCache (Redis) |
| Banco relacional | RDS (MySQL via Prisma) |
| Observabilidade proposta | CloudWatch, Datadog |
| Alertas propostos | CloudWatch Alarms + Datadog |

---

## Serviços

### `leitura-ativos` — API de Leitura (ECS 24/7)

Serve cotações, ordens e posições. A primeira tentativa de leitura é feita no Redis; se o cache falhar, o serviço consulta o banco (fallback).

```
GET /                       health check
GET /quotations             lista todos os ativos e cotações
GET /quotations/:symbol     cotação de um ativo específico
GET /orders?userId=...      ordens de um usuário (desc por createdAt)
GET /orders/:id             detalhe de uma ordem
GET /positions?userId=...   carteira do usuário com profit/loss
```

**Cálculo de P&L:**
```
profit_loss = quantity × (current_price − average_price)
```

**Camadas internas:**
```
QuotationController
  → QuotationService
      → Redis (primário)
      → Prisma/MySQL (fallback apenas se Redis lançar erro)

PositionController
  → PositionService
      → Prisma (positions + include asset)
      → calcula profit_loss
      → ordena por quantity × current_price
```

---

### `criar-ordens-api` — API de Criação (ECS horário comercial)

Valida, persiste e enfileira ordens. Retorna `201` com `status: PENDENTE` depois que a ordem é salva e publicada no SQS.

```
GET  /health
POST /orders          cria ordem de COMPRA ou VENDA
POST /orders/:id/cancel   cancela uma ordem
```

**Fluxo interno:**

1. `OrderController` valida campos obrigatórios, `type` (`COMPRA` | `VENDA`), `quantity > 0`, `price > 0`.
2. `BalanceService` busca saldo mockado do usuário.
3. Para `COMPRA`: valida `cash >= quantity × price`.
4. Para `VENDA`: valida posição suficiente do ativo.
5. Cria ordem no MySQL com `status: PENDENTE`.
6. `SQSService.send()` publica mensagem na fila `orders-queue`.
7. Retorna `{ success: true, orderId, status: "PENDENTE" }`.

> A validação da posição e o decremento atômico reduzem o risco de vender mais ativos do que o usuário possui.

---

### `processamento-ativos` — Lambda (acionada via SQS)

Executa ou rejeita ordens. Como o SQS pode entregar a mesma mensagem mais de uma vez, o serviço usa uma transição atômica de status para evitar efeitos duplicados.

**Mensagens aceitas:** `PENDENTE` e `CANCELADA`. Qualquer outro status é ignorado e pode ser registrado em log para investigação.

**Atomic claim (idempotência):**
```
updateMany WHERE status = PENDENTE → status = PROCESSANDO
se count === 0 → ordem já foi capturada, cancelada ou duplicada → ignora
```

**Para COMPRA:**
- Busca posição atual do usuário para o ativo.
- Se existe: soma quantidade + recalcula preço médio + atualiza `totalValue`.
- Se não existe: cria nova posição.

**Para VENDA:**
- Decremento atômico com condição: `userId = X AND symbol = Y AND quantity >= quantidade_venda`.
- Se nenhuma linha atualizada: saldo insuficiente → rejeita.

**Estados finais:**
```
PROCESSANDO → EXECUTADA   (sucesso)
PROCESSANDO → REJEITADA   (saldo/posição insuficiente ou erro)
```

As mudanças de status e posição acontecem dentro de uma `prisma.$transaction`, evitando atualização parcial quando ocorre erro no processamento.

---

### `atualiza-ativos` — Worker (ECS)

Consome cotações de serviço externo e atualiza Redis + banco de forma contínua.

**Estratégias (Strategy Pattern):**

- `HttpQuotationSourceStrategy` — busca cotação via HTTP externo com retry e backoff.
- `RedisQuotationSaver` — persiste no cache.
- `DbQuotationSaver` — persiste histórico no banco.
- `CompositeQuotationSaver` — agrupa persistência em Redis e banco atrás da mesma interface.

---

## Design Patterns

Algumas decisões de implementação seguem padrões conhecidos. A lista abaixo mostra onde eles aparecem no projeto, sem tratar os padrões como objetivo por si só.

### Padrões GoF

| Pattern | Onde aparece | Por quê |
|---|---|---|
| **Strategy** | `atualiza-ativos` — `QuotationSourceStrategy`, `QuotationSaverStrategy` | Permite trocar fonte ou destino de cotação sem alterar o processador |
| **Factory** | `QuotationSourceFactory`, `QuotationSaverFactory` | Centraliza criação das estratégias, evita `new` espalhado |
| **Composite** | `CompositeQuotationSaver` | Agrupa múltiplos destinos de persistência em um único saver |
| **Adapter** | `QuotationService` — conversão Prisma → API, Redis → domínio | Normaliza dados vindos de fontes diferentes |
| **Facade** | `api.ts` no front-end; services no backend | Concentra chamadas externas e detalhes de infraestrutura |
| **Singleton** | `prisma.ts`, `redis.ts`, `Logger.ts` | Evita múltiplas conexões; centraliza recursos globais |

### Padrões Arquiteturais e de Resiliência

| Pattern | Onde aparece | Por quê |
|---|---|---|
| **Dependency Injection** | `QuotationProcessor`, `OrderController`, `QuotationService` | Facilita testes e mocks sem acoplar a implementações concretas |
| **Layered Architecture** | Controllers → Services → Prisma/Redis | Separa HTTP, regra de negócio e infraestrutura |
| **Producer / Consumer** | `criar-ordens-api` (producer) + Lambda (consumer) | Desacopla criação do processamento; API responde rápido |
| **Idempotent Consumer** | `processamento-ativos` — atomic claim via `updateMany` | SQS pode re-entregar; evita execução duplicada da mesma ordem |
| **Unit of Work** | `prisma.$transaction` no processamento | Mudanças de status e posição acontecem juntas ou não acontecem |
| **Cache-Aside / Fallback** | `QuotationService` — Redis → MySQL | Usa cache para leitura rápida e banco como fallback |
| **State Machine** | Ordens: `PENDENTE → PROCESSANDO → EXECUTADA / REJEITADA / CANCELADA` | Controla quais transições são permitidas; impede estados inválidos |
| **Retry com Backoff** | `HttpQuotationSourceStrategy`, `OrderService` | Trata falhas temporárias de rede ou banco |

---

## Fluxo de Compra e Venda

```
flowchart TD
    usuario[Cliente / Front-end]

    subgraph aws[AWS]
        subgraph ecs24[ECS - APIs e Workers]
            leitura[leitura-ativos API\nECS 24/7]
            criar[criar-ordens-api\nECS em horário comercial]
            atualiza[atualiza-ativos\nWorker ECS]
        end

        sqs[Amazon SQS\nFila de ordens pendentes]
        lambda[processamento-ativos\nAWS Lambda acionada via SQS]
        redis[(Redis / ElastiCache)]
        banco[(Banco de dados)]
        mercado[Serviço externo de cotações / mercado]
    end

    usuario -->|Consulta ativos, posição e status| leitura
    leitura -->|Busca cache| redis
    leitura -->|Fallback / dados persistidos| banco

    atualiza -->|Consulta cotações| mercado
    atualiza -->|Atualiza cotações em cache| redis
    atualiza -->|Persiste histórico / última cotação| banco

    usuario -->|Envia ordem de COMPRA ou VENDA| criar
    criar -->|Valida horário comercial, ativo, usuário e payload| banco
    criar -->|Cria ordem com status PENDENTE| banco
    criar -->|Publica ordem PENDENTE| sqs

    sqs -->|Trigger por mensagem| lambda
    lambda -->|Carrega ordem, saldo, posição e cotação| banco
    lambda -->|Consulta cotação/cache quando necessário| redis

    lambda --> decisao{Tipo de ordem}
    decisao -->|COMPRA| validaCompra{Saldo suficiente?}
    decisao -->|VENDA| validaVenda{Posição suficiente?}

    validaCompra -->|Sim| executa[Executa ordem]
    validaCompra -->|Não| rejeita[Rejeita ordem]
    validaVenda -->|Sim| executa
    validaVenda -->|Não| rejeita

    executa -->|Atualiza status EXECUTADO,\nsaldo e posição| banco
    executa -->|Atualiza cache de status/posição| redis
    rejeita -->|Atualiza status REJEITADO\ncom motivo| banco
    rejeita -->|Atualiza cache de status| redis

    usuario -->|Consulta status da ordem| leitura
```

**Resumo do fluxo:**

1. O cliente consulta ativos, posição e status pela API `leitura-ativos`, disponível 24/7 no ECS.
2. O worker `atualiza-ativos`, também no ECS, mantém cotações frescas no Redis e no banco.
3. Em horário comercial, o cliente envia uma ordem para `criar-ordens-api`.
4. A API persiste a ordem como `PENDENTE` e publica a mensagem no SQS.
5. O SQS aciona a Lambda `processamento-ativos`.
6. A Lambda valida: compra exige saldo suficiente; venda exige posição suficiente.
7. A ordem termina como `EXECUTADA` ou `REJEITADA`; o cliente consulta o resultado via `leitura-ativos`.

---

## Testes

### Testes de Performance - Propostos

Os cenários abaixo são referências para validar comportamento sob carga em um ambiente provisionado para isso.

| Cenário | Descrição | Objetivo |
|---|---|---|
| **Rampa gradual** | Aumento progressivo de usuários por 20 min, sustentado por 30 min | Verificar comportamento sob carga crescente |
| **Stress Test** | Aumento rápido de demanda em poucos minutos | Simular aumento brusco de uso |
| **Soak Test** | Carga sustentada por 4 horas | Detectar vazamento de memória e degradação acumulada |
| **Spike Test** | Picos curtos de requisições | Simular abertura de mercado e verificar recuperação pós-pico |

---

### Testes E2E (Integração)

**Fluxo de sucesso:**
1. Consulta ativos via `leitura-ativos`
2. Cria ordem via `criar-ordens-api`
3. Consulta status → espera `EXECUTADA`

**Fluxo de erro — saldo insuficiente:**
1. Consulta ativos
2. Cria ordem (COMPRA)
3. Mock de saldo insuficiente ativo
4. Consulta status → espera `REJEITADA`

**Fluxo de erro — falha na criação:**
1. Consulta ativos
2. Erro ao criar ordem → nenhuma ordem criada

**Fluxo de resiliência — Redis fora do ar:**
1. Redis indisponível
2. Consulta ativos cai no fallback do banco
3. Cria ordem normalmente
4. Consulta status → espera `EXECUTADA`

---

### Testes Sintéticos Propostos

Podem ser executados após cada deploy para validar se os principais fluxos continuam funcionando.

**`atualiza-ativos`:**
1. Deploy sobe
2. Teste aguarda 5 minutos
3. Consulta dado no banco e no Redis
4. Valida que timestamp ou valor mudou dentro do esperado
5. Passa ou reprova a pipeline

**`criar-ordens`:**
1. Envia uma ordem
2. Valida resposta `201` com `status: PENDENTE`
3. Valida persistência no banco

**`leitura-ativos`:**
1. Consulta cotação de ativo conhecido no Redis
2. Consulta status de ordem no Redis e banco
3. Consulta posição do usuário no Redis e banco
4. Valida `200` com dados coerentes

**`processamento-ativos`:**

*Cenário de execução:*
1. Publica ordem `PENDENTE` no SQS
2. Aguarda tempo médio de processamento
3. Consulta status → valida `EXECUTADA`
4. Tenta cancelar → valida erro (ordem já executada)

*Cenário de cancelamento:*
1. Publica ordem `PENDENTE` no SQS
2. Consulta status → ainda `PENDENTE`
3. Cancela a ordem
4. Ordem finaliza com `CANCELADA`

---

## Observabilidade e Dashboards - Propostas

A observabilidade acompanha a ordem desde a criação até o processamento final. Abaixo estão quatro visões úteis para produção.

---

### Dashboard 1 — Executivo / SLA & SLO

Responde: *"O sistema está saudável para o cliente?"*

**Semáforo de saúde da ordem** — card único calculado com base em seis sinais:

| Sinal | Status esperado |
|---|---|
| API criando ordens | ativo |
| SQS recebendo mensagens | ativo |
| Worker processando | ativo |
| Cotação fresca (< 10s) | ativo |
| Banco respondendo | ativo |
| DLQ vazia | ativo |

**Métricas principais:**

| Indicador | SLO target |
|---|---|
| Disponibilidade da API | ≥ 99,9% |
| Latência p95 | < 300ms |
| Latência p99 | < 500ms |
| Taxa de erro 5xx | < 1% |
| Ordens criadas com sucesso | ≥ 99% |
| Ordens processadas em até 5s | ≥ 99% |
| Freshness das cotações | ≤ 10s de atraso |

---

### Dashboard 2 — Jornada do Cliente

Responde: *"Onde o cliente está sentindo problema?"*

Exibe um funil do fluxo completo:

```
12.400 requisições
↓
12.028 validadas
↓
11.740 com cotação OK
↓
11.626 enfileiradas
↓
11.254 processadas
↓
~150 falhas / retries
```

| Etapa | Métrica monitorada |
|---|---|
| Criar ordem | requests, erros, latência |
| Validar saldo | taxa sucesso/falha |
| Buscar cotação | cache hit/miss, fallback |
| Enfileirar ordem | mensagens enviadas ao SQS |
| Processar ordem | sucesso, falha, retries |
| Consultar ativos | latência e erros |

---

### Dashboard 3 — Operacional / Engenharia

Responde: *"Qual componente está quebrando?"*

**`criar-ordens-api`:**

| Métrica | Alerta |
|---|---|
| HTTP 5xx | CRITICAL se > 2% por 5 min |
| Latência p95 | WARNING se > 500ms |
| Erros de validação | WARNING se aumento anormal |
| Falha ao enfileirar no SQS | WARNING em qualquer pico |

**`processamento-ativos`:**

| Métrica | Alerta |
|---|---|
| Mensagens processadas/min | CRITICAL se queda brusca |
| Taxa de erros | WARNING se > limite |
| Retries | WARNING se crescente |
| DLQ | CRITICAL se > 0 mensagens |
| Mensagem mais antiga | CRITICAL se > 2 min |

**`atualiza-ativos`:**

| Métrica | Alerta |
|---|---|
| Última cotação atualizada | CRITICAL se > 30s |
| Erro no serviço externo | WARNING se > 3x seguidas |
| Latência do fornecedor externo | WARNING se elevada |
| Falha ao escrever Redis/DB | CRITICAL |

**`leitura-ativos`:**

| Métrica | Alerta |
|---|---|
| Latência p95 | WARNING se elevado |
| Cache hit ratio | WARNING se < 70% |
| Erro no Redis/DB | CRITICAL em qualquer pico |
| Ativos retornados | WARNING se queda inesperada |

---

### Dashboard 4 — Deploy / Implantação

Responde: *"O deploy piorou algo?"*

Compara métricas antes e depois de cada deploy, com anotação automática no gráfico de séries temporais.

| Métrica | Antes | Depois |
|---|---|---|
| Versão | v1.4.1 | v1.4.2 |
| Erro 5xx | 0.28% | 0.31% |
| Latência p95 | 192ms | 187ms |
| Rollback | — | disponível |

Se uma métrica crítica piorar significativamente após o deploy, o dashboard deve facilitar a decisão de rollback.

---

### Alarmes

**Critical (acionar incidente imediatamente):**

- API indisponível
- Erro 5xx > 5% por 5 min
- DLQ > 0 mensagens
- Cotação sem atualização há mais de 30s
- Mensagem mais antiga na fila > 2 min
- Falha ao gravar ordem no banco

**Warning (investigar e monitorar):**

- Latência p95 > 500ms
- Cache hit ratio < 70%
- Retries crescendo
- Erro no fornecedor externo > 3 vezes seguidas
- CPU > 80%
- Memória > 80%

---

### Stack de Observabilidade

**AWS (produção sugerida):**
CloudWatch Dashboards · CloudWatch Alarms · X-Ray / OpenTelemetry · SQS Metrics · ECS / Lambda Metrics · RDS Metrics · ElastiCache Metrics · SNS ou Slack para alertas

**Local / demo:**
Prometheus · Grafana · OpenTelemetry · Jaeger · Loki

---

## SLOs e Error Budget

O error budget é a margem de falha permitida pelo SLO. Se o SLO é 99,9% de criações com sucesso em um mês com 1.000.000 requisições, o budget é de 1.000 falhas permitidas.

### Tabela de SLOs e Budgets

| SLO | Error Budget |
|---|---|
| 99,9% das criações de ordem com sucesso | 0,1% de falhas |
| 99% das ordens processadas em até 5s | 1% pode ultrapassar 5s |
| 99% das cotações atualizadas em até 10s | 1% pode ficar desatualizada |
| 99,5% das leituras de ativos em até 300ms | 0,5% pode exceder 300ms |

### Regras de Consumo do Budget

```
Consumo ≥ 50% em uma semana  →  ⚠  warning: revisar causa raiz
Consumo ≥ 80%                →  🔴  congelar deploys não críticos
Consumo = 100%               →  🚨  incidente: foco em estabilidade antes de novas features
```

### Exemplo de Card no Dashboard

```
Error Budget — Criação de Ordens
─────────────────────────────────
SLO:           99,9%
Budget mensal: 1.000 falhas
Consumido:       420 falhas
Restante:         58%
Status:         🟡 Atenção
```

---

## Como Rodar Localmente

```bash
# Clonar e instalar
cd case-eng-dist
cd quotation-service
npm install

# Subir serviços de infraestrutura
docker compose up -d --build

# Iniciar em modo de desenvolvimento
npm run dev
```

**Dependências locais (via Docker Compose):**
- MySQL (Prisma como ORM)
- Redis
- LocalStack (emulação de SQS para ambiente de desenvolvimento)


*Última atualização: maio de 2026.*
