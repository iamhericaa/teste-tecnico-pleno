import json
import os

import pymysql
import redis


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

# 1. Cotacoes de referencia dos ativos
cur.execute("SELECT symbol, name, reference_price, created_at, updated_at FROM assets")
for row in cur.fetchall():
    price_key = f"price:{row['symbol']}"
    r.set(price_key, str(row["reference_price"]))
    print(f"OK {price_key} -> {row['reference_price']}")

    latest_key = f"asset:{row['symbol']}:latest"
    r.set(
        latest_key,
        json.dumps(
            {
                "symbol": row["symbol"],
                "name": row["name"],
                "reference_price": str(row["reference_price"]),
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            }
        ),
    )
    print(f"OK {latest_key} -> {row['name']}")

# 2. Posicoes dos usuarios
cur.execute("SELECT user_id, symbol, quantity, average_price FROM positions")
for row in cur.fetchall():
    key = f"position:{row['user_id']}:{row['symbol']}"
    r.set(
        key,
        json.dumps(
            {
                "quantity": str(row["quantity"]),
                "average_price": str(row["average_price"]),
            }
        ),
    )
    print(f"OK {key} -> qty={row['quantity']}")

cur.close()
db.close()
print("\nRedis inicializado com sucesso!")
