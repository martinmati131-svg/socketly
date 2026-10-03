"""Offline-first delivery queue for edge detection logs.

Run this daemon on the edge device that captures detections. Configure DB_FILE
and CLOUD_ENDPOINT in the device environment; the cloud endpoint should accept
JSON POST requests and return a 2xx response after durable storage.
"""

import json
import os
import sqlite3
import time
from typing import Any

import requests

DB_FILE = os.environ.get("DB_FILE", "./aura-edge.sqlite3")
CLOUD_ENDPOINT = os.environ.get("CLOUD_ENDPOINT")
BATCH_SIZE = 10
POLL_INTERVAL_SECONDS = 10
REQUEST_TIMEOUT_SECONDS = 5


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_FILE)
    connection.execute("PRAGMA busy_timeout = 5000")
    return connection


def init_db() -> None:
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS pending_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                payload TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'PENDING',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


def queue_detection(payload: dict[str, Any]) -> None:
    with get_connection() as connection:
        connection.execute(
            "INSERT INTO pending_logs (payload) VALUES (?)",
            (json.dumps(payload, separators=(",", ":")),),
        )


def sync_flush() -> int:
    if not CLOUD_ENDPOINT:
        raise RuntimeError("CLOUD_ENDPOINT is not configured")

    with get_connection() as connection:
        records = connection.execute(
            "SELECT id, payload FROM pending_logs "
            "WHERE status = 'PENDING' ORDER BY id ASC LIMIT ?",
            (BATCH_SIZE,),
        ).fetchall()

        flushed = 0
        for log_id, payload_text in records:
            try:
                response = requests.post(
                    CLOUD_ENDPOINT,
                    json=json.loads(payload_text),
                    timeout=REQUEST_TIMEOUT_SECONDS,
                )
                response.raise_for_status()
            except (requests.RequestException, json.JSONDecodeError) as error:
                print(f"[SYNC] Delivery paused: {error}")
                break

            connection.execute("DELETE FROM pending_logs WHERE id = ?", (log_id,))
            flushed += 1
            print(f"[SYNC] Flushed log record #{log_id}")

        return flushed


def main() -> None:
    init_db()
    print("Aura Edge offline-first daemon started")

    while True:
        try:
            sync_flush()
        except (OSError, RuntimeError, sqlite3.Error) as error:
            print(f"[SYNC] Queue unavailable: {error}")
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
