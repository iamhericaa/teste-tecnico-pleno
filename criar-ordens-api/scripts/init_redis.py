import pymysql
import redis
import os
import json

db = pymysql.connect(
    host=os.getenv("DB_HOST"),
    port=int(os.getenv("DB_PORT")),
    database=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    cursorclass=pymysql.cursors.DictCursor,
)

r = redis.Redis(
    host=os.getenv("REDIS_HOST"),
    port=int(os.getenv("REDIS_PORT")),
    decode_responses=True,
)

cur = db.cursor()

# 1. Preços de referência dos ativos
cur.execute("SELECT symbol, reference_price FROM assets")
for row in cur.fetchall():
    key = f"price:{row['symbol']}"
    r.set(key, str(row['reference_price']))
    print(f"✅ {key} → {row['reference_price']}")

# 2. Posições dos usuários
cur.execute("SELECT user_id, symbol, quantity, average_price FROM positions")
for row in cur.fetchall():
    key = f"position:{row['user_id']}:{row['symbol']}"
    r.set(key, json.dumps({
        "quantity": str(row['quantity']),
        "average_price": str(row['average_price']),
    }))
    print(f"✅ {key} → qty={row['quantity']}")

cur.close()
db.close()
print("\n🚀 Redis inicializado com sucesso!")