"""Stream Raspberry Pi telemetry to the AURA Edge Socket.IO endpoint."""

import json
import os
import socket
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

import socketio


SERVER_URL = os.getenv("AURA_SERVER_URL", "https://powerdreams.top")
SOCKET_PATH = os.getenv("AURA_SOCKET_PATH", "/api/socket")
DEVICE_ID = os.getenv("AURA_DEVICE_ID", "AURA-EDGE-01")
INTERVAL_SECONDS = float(os.getenv("AURA_TELEMETRY_INTERVAL", "1"))
THERMAL_ALERT_THRESHOLD = float(os.getenv("AURA_THERMAL_ALERT_THRESHOLD", "75"))
THERMAL_ALERT_URL = os.getenv("AURA_THERMAL_ALERT_URL", f"{SERVER_URL}/api/telemetry/thermal")

sio = socketio.Client(reconnection=True, logger=False, engineio_logger=False)


def get_cpu_temp() -> float:
    """Read the Raspberry Pi thermal zone, with a safe fallback for development."""
    try:
        raw_value = Path("/sys/class/thermal/thermal_zone0/temp").read_text().strip()
        return round(float(raw_value) / 1000.0, 1)
    except (OSError, ValueError):
        return 42.8


def get_uptime() -> str:
    """Return a compact uptime value when available."""
    try:
        uptime_seconds = int(float(Path("/proc/uptime").read_text().split()[0]))
    except (OSError, ValueError, IndexError):
        return "unknown"

    days, remainder = divmod(uptime_seconds, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes = remainder // 60
    return f"{days}d {hours:02d}h {minutes:02d}m"


def get_signal_strength() -> int:
    """Return Wi-Fi signal quality when iwconfig is available."""
    try:
        import subprocess

        output = subprocess.check_output(
            ["iwconfig", "wlan0"], text=True, stderr=subprocess.DEVNULL
        )
        quality = output.split("Link Quality=")[1].split()[0]
        current, maximum = quality.split("/")
        return round(float(current) / float(maximum) * 100)
    except (OSError, subprocess.CalledProcessError, IndexError, ValueError, ZeroDivisionError):
        return 98


@sio.event
def connect() -> None:
    print(f"Connected to {SERVER_URL} as {DEVICE_ID}")


@sio.event
def disconnect() -> None:
    print("Telemetry connection closed; retrying...")


def monitor_thermal_threshold(device_id: str, cpu_temp: float) -> None:
    """Notify the Next.js thermal route when a device crosses the alert threshold."""
    if cpu_temp <= THERMAL_ALERT_THRESHOLD:
        return

    request = Request(
        THERMAL_ALERT_URL,
        data=json.dumps({"deviceId": device_id, "cpuTemp": cpu_temp}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=2) as response:
            if response.status >= 400:
                print(f"[ALERT CHECK FAILED] thermal endpoint returned HTTP {response.status}")
    except (OSError, URLError) as error:
        print(f"[ALERT CHECK FAILED] {error}")


def build_payload() -> dict[str, object]:
    return {
        "deviceId": DEVICE_ID,
        "status": "Operational",
        "cpuTemp": get_cpu_temp(),
        "signalStrength": get_signal_strength(),
        "uptime": get_uptime(),
        "hostname": socket.gethostname(),
    }


def main() -> None:
    sio.connect(SERVER_URL, socketio_path=SOCKET_PATH)
    try:
        while True:
            payload = build_payload()
            sio.emit("telemetry_update", payload)
            monitor_thermal_threshold(DEVICE_ID, float(payload["cpuTemp"]))
            time.sleep(INTERVAL_SECONDS)
    except KeyboardInterrupt:
        print("Stopping telemetry client")
    finally:
        sio.disconnect()


if __name__ == "__main__":
    main()
