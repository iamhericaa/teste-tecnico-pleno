import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const testType = (__ENV.TEST_TYPE || "ramp").toLowerCase();
const quick = (__ENV.QUICK || "false").toLowerCase() === "true";

const readBaseUrl = __ENV.READ_BASE_URL || "http://localhost:62000";
const writeBaseUrl = __ENV.WRITE_BASE_URL || "http://localhost:62001";
const writePercent = Number(__ENV.WRITE_PERCENT || "10");
const maxVus = Number(__ENV.MAX_VUS || "50");
const thinkTimeSeconds = Number(__ENV.THINK_TIME_SECONDS || "1");
const targetOrderRps = Number(__ENV.TARGET_ORDER_RPS || "1000");
const targetQuotationRps = Number(__ENV.TARGET_QUOTATION_RPS || "10000");
const targetConcurrentUsers = Number(__ENV.TARGET_CONCURRENT_USERS || "50000");
const targetDuration = __ENV.TARGET_DURATION || (quick ? "2m" : "30m");
const targetGracefulStop = __ENV.TARGET_GRACEFUL_STOP || "30s";

const effectiveOrderRps = quick ? Math.min(targetOrderRps, 10) : targetOrderRps;
const effectiveQuotationRps = quick ? Math.min(targetQuotationRps, 100) : targetQuotationRps;
const effectiveConcurrentUsers = quick
  ? Math.min(targetConcurrentUsers, 250)
  : targetConcurrentUsers;

const users = (__ENV.USER_IDS || "user-001,user-002,user-003")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const symbols = (__ENV.SYMBOLS || "ITUB4,USDC,HRC,BTC,ETH")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const successfulOrders = new Counter("orders_created_successfully");
const rejectedOrders = new Counter("orders_rejected_or_invalid");
const createOrderLatency = new Trend("create_order_latency");
const readJourneyLatency = new Trend("read_journey_latency");
const quotationLookupLatency = new Trend("quotation_lookup_latency");

function arrivalScenario(rate, exec, tags, preAllocatedVus) {
  return {
    executor: "constant-arrival-rate",
    rate,
    timeUnit: "1s",
    duration: targetDuration,
    preAllocatedVUs: preAllocatedVus,
    maxVUs: effectiveConcurrentUsers,
    gracefulStop: targetGracefulStop,
    exec,
    tags,
  };
}

const profiles = {
  ramp: {
    scenarios: {
      default: {
        executor: "ramping-vus",
        stages: quick
          ? [
              { duration: "30s", target: Math.min(maxVus, 10) },
              { duration: "1m", target: Math.min(maxVus, 10) },
              { duration: "30s", target: 0 },
            ]
          : [
              { duration: "20m", target: maxVus },
              { duration: "30m", target: maxVus },
              { duration: "5m", target: 0 },
            ],
      },
    },
  },
  stress: {
    scenarios: {
      default: {
        executor: "ramping-vus",
        stages: quick
          ? [
              { duration: "30s", target: Math.min(maxVus, 20) },
              { duration: "1m", target: Math.min(maxVus * 2, 40) },
              { duration: "30s", target: 0 },
            ]
          : [
              { duration: "2m", target: maxVus },
              { duration: "3m", target: maxVus * 2 },
              { duration: "5m", target: maxVus * 3 },
              { duration: "5m", target: 0 },
            ],
      },
    },
  },
  soak: {
    scenarios: {
      default: {
        executor: "constant-vus",
        vus: quick ? Math.min(maxVus, 10) : maxVus,
        duration: quick ? "2m" : "4h",
      },
    },
  },
  spike: {
    scenarios: {
      default: {
        executor: "ramping-vus",
        stages: quick
          ? [
              { duration: "10s", target: Math.min(maxVus * 2, 60) },
              { duration: "20s", target: Math.min(maxVus * 2, 60) },
              { duration: "10s", target: 0 },
              { duration: "30s", target: Math.min(maxVus, 10) },
              { duration: "10s", target: 0 },
            ]
          : [
              { duration: "30s", target: maxVus * 3 },
              { duration: "2m", target: maxVus * 3 },
              { duration: "30s", target: 0 },
              { duration: "5m", target: maxVus },
              { duration: "2m", target: 0 },
            ],
      },
    },
  },
  target: {
    scenarios: {
      quotation_load: arrivalScenario(
        effectiveQuotationRps,
        "quotationLookup",
        { workload: "quotation_lookup" },
        quick ? 50 : Math.min(5000, effectiveConcurrentUsers)
      ),
      order_load: arrivalScenario(
        effectiveOrderRps,
        "createOrder",
        { workload: "create_order" },
        quick ? 25 : Math.min(3000, effectiveConcurrentUsers)
      ),
      concurrent_users: {
        executor: "constant-vus",
        vus: effectiveConcurrentUsers,
        duration: targetDuration,
        gracefulStop: targetGracefulStop,
        exec: "userSession",
        tags: { workload: "concurrent_users" },
      },
    },
  },
};

export const options = {
  ...(profiles[testType] || profiles.ramp),
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    create_order_latency: ["p(95)<800"],
    read_journey_latency: ["p(95)<500"],
    quotation_lookup_latency: ["p(95)<300"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
};

export function setup() {
  const readHealth = http.get(`${readBaseUrl}/`);
  const writeHealth = http.get(`${writeBaseUrl}/health`);

  check(readHealth, {
    "leitura-ativos esta respondendo": (res) => res.status === 200,
  });

  check(writeHealth, {
    "criar-ordens-api esta saudavel": (res) => res.status === 200,
  });
}

export default function () {
  mixedJourney();
}

export function quotationLookup() {
  group("quotation lookup", () => {
    const startedAt = Date.now();
    const symbol = pick(symbols);
    const response = http.get(`${readBaseUrl}/quotations/${symbol}`);

    check(response, {
      "GET /quotations/:symbol retorna 200": (res) => res.status === 200,
    });

    quotationLookupLatency.add(Date.now() - startedAt);
  });
}

export function createOrder() {
  group("create order", () => {
    const response = postOrder();

    createOrderLatency.add(response.timings.duration);

    const accepted = check(response, {
      "POST /criar-ordens retorna 201 ou 400 controlado": (res) =>
        res.status === 201 || res.status === 400,
    });

    if (response.status === 201) {
      successfulOrders.add(1);
    } else if (accepted) {
      rejectedOrders.add(1);
    }
  });
}

export function userSession() {
  const action = randomInt(1, 100);

  if (action <= 80) {
    quotationLookup();
  } else if (action <= 95) {
    readJourney();
  } else {
    createOrder();
  }

  sleep(thinkTimeSeconds);
}

function mixedJourney() {
  const shouldWrite = randomInt(1, 100) <= writePercent;

  readJourney();

  if (shouldWrite) {
    createOrder();
  }

  sleep(thinkTimeSeconds);
}

function readJourney() {
  group("read journey", () => {
    const startedAt = Date.now();
    const userId = pick(users);
    const symbol = pick(symbols);

    const responses = http.batch([
      ["GET", `${readBaseUrl}/quotations`],
      ["GET", `${readBaseUrl}/quotations/${symbol}`],
      ["GET", `${readBaseUrl}/positions?userId=${encodeURIComponent(userId)}`],
      ["GET", `${readBaseUrl}/orders?userId=${encodeURIComponent(userId)}`],
    ]);

    check(responses[0], {
      "GET /quotations retorna 200": (res) => res.status === 200,
    });
    check(responses[1], {
      "GET /quotations/:symbol retorna 200": (res) => res.status === 200,
    });
    check(responses[2], {
      "GET /positions retorna 200": (res) => res.status === 200,
    });
    check(responses[3], {
      "GET /orders retorna 200": (res) => res.status === 200,
    });

    readJourneyLatency.add(Date.now() - startedAt);
  });
}

function postOrder() {
  const symbol = pick(["ITUB4", "USDC", "HRC"]);
  const quantity = Number((Math.random() * 2 + 0.1).toFixed(2));
  const price = symbol === "HRC" ? 100 : symbol === "USDC" ? 5.5 : 32.8;

  const payload = JSON.stringify({
    userId: pick(["user-001", "user-002"]),
    symbol,
    type: "COMPRA",
    quantity,
    price,
  });

  return http.post(`${writeBaseUrl}/criar-ordens`, payload, {
    headers: { "Content-Type": "application/json" },
  });
}

function pick(values) {
  return values[randomInt(0, values.length - 1)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
