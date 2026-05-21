# Testes de performance

Suite k6 para executar os cenarios propostos no README: rampa gradual, stress, soak e spike.

## Pre-requisitos

- Docker e Docker Compose
- Aplicacao local de pe: `docker compose up -d --build`
- k6 instalado localmente ou via imagem Docker `grafana/k6`

## Dashboard local

O `docker-compose.yml` sobe Prometheus e Grafana junto com a aplicacao:

- Grafana: `http://localhost:3000`
- Login: `admin` / `admin`
- Prometheus: `http://localhost:9090`

O datasource Prometheus ja e provisionado automaticamente no Grafana.
O dashboard `k6 - Performance Ordens` tambem sobe automaticamente na pasta `Performance`.

## Smoke test rapido com metricas no Grafana

Rode o k6 pelo profile `performance` para exportar as metricas para o Prometheus:

```powershell
$env:QUICK="true"
$env:TEST_TYPE="target"
docker compose --profile performance run --rm k6
```

Depois abra o Grafana em `http://localhost:3000` e acesse `Dashboards > Performance > k6 - Performance Ordens`.

## Smoke test rapido via Docker direto

Use `QUICK=true` para validar o script sem esperar a duracao real do cenario.

```bash
docker run --rm -i --network host -v "$PWD/scripts/performance:/scripts" grafana/k6 run \
  -e QUICK=true \
  -e TEST_TYPE=ramp \
  -e K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write \
  -o experimental-prometheus-rw \
  /scripts/orders-load-test.js
```

No PowerShell, se `--network host` nao funcionar com Docker Desktop, use `host.docker.internal`:

```powershell
docker run --rm -i -v ${PWD}/scripts/performance:/scripts grafana/k6 run `
  -e QUICK=true `
  -e TEST_TYPE=ramp `
  -e READ_BASE_URL=http://host.docker.internal:62000 `
  -e WRITE_BASE_URL=http://host.docker.internal:62001 `
  -e K6_PROMETHEUS_RW_SERVER_URL=http://host.docker.internal:9090/api/v1/write `
  -o experimental-prometheus-rw `
  /scripts/orders-load-test.js
```

## Cenarios completos

```powershell
$env:QUICK="false"; $env:TEST_TYPE="ramp"; docker compose --profile performance run --rm k6
$env:QUICK="false"; $env:TEST_TYPE="stress"; docker compose --profile performance run --rm k6
$env:QUICK="false"; $env:TEST_TYPE="soak"; docker compose --profile performance run --rm k6
$env:QUICK="false"; $env:TEST_TYPE="spike"; docker compose --profile performance run --rm k6
```

## Cenario alvo de negocio

O perfil `target` representa a seguinte carga:

| Metrica | Volume |
|---|---:|
| Ordens por segundo | ~1.000 |
| Usuarios simultaneos | ~50.000 |
| Consultas de cotacao/segundo | ~10.000 |

Execucao reduzida para validar localmente:

```powershell
$env:QUICK="true"
$env:TEST_TYPE="target"
docker compose --profile performance run --rm k6
```

Execucao completa:

```powershell
$env:QUICK="false"
$env:TEST_TYPE="target"
$env:TARGET_ORDER_RPS="1000"
$env:TARGET_QUOTATION_RPS="10000"
$env:TARGET_CONCURRENT_USERS="50000"
$env:TARGET_DURATION="30m"
docker compose --profile performance run --rm k6
```

## Variaveis uteis

| Variavel | Padrao | Uso |
|---|---:|---|
| `TEST_TYPE` | `ramp` | `ramp`, `stress`, `soak`, `spike` ou `target` |
| `QUICK` | `false` | Executa uma versao curta para validacao local |
| `READ_BASE_URL` | `http://localhost:62000` | Base URL da API `leitura-ativos` |
| `WRITE_BASE_URL` | `http://localhost:62001` | Base URL da API `criar-ordens-api` |
| `MAX_VUS` | `50` | Quantidade base de usuarios virtuais |
| `TARGET_ORDER_RPS` | `1000` | Taxa alvo de criacao de ordens por segundo no perfil `target` |
| `TARGET_QUOTATION_RPS` | `10000` | Taxa alvo de consultas de cotacao por segundo no perfil `target` |
| `TARGET_CONCURRENT_USERS` | `50000` | Usuarios virtuais simultaneos no perfil `target` |
| `TARGET_DURATION` | `30m` | Duracao do perfil `target` quando `QUICK=false` |
| `WRITE_PERCENT` | `10` | Percentual de iteracoes que cria ordens |
| `THINK_TIME_SECONDS` | `1` | Pausa entre iteracoes por VU |
| `USER_IDS` | `user-001,user-002,user-003` | Usuarios usados nas leituras |
| `SYMBOLS` | `ITUB4,USDC,HRC,BTC,ETH` | Ativos usados nas leituras |

## Observacoes

- O teste faz leituras em `/quotations`, `/quotations/:symbol`, `/positions` e `/orders`.
- Uma parte da carga cria ordens em `POST /criar-ordens`, entao o banco e a fila SQS recebem dados reais.
- Para testes longos, prefira um ambiente dedicado e monitore CPU, memoria, conexoes MySQL, Redis, fila SQS e latencias p95/p99.
- Se quiser carga somente de leitura, rode com `WRITE_PERCENT=0`.
