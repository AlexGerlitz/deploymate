#!/usr/bin/env python3

from __future__ import annotations

import argparse
import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path


def pid_alive(pid: int | None) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def url_alive(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.3):
            return True
    except OSError:
        return False


def read_state(path: Path) -> dict[str, object]:
    if not path.exists():
        return {}
    try:
        state: dict[str, object] = {}
        for line in path.read_text(encoding="utf-8").splitlines():
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            state[key.strip()] = value.strip()
        return state
    except Exception:
        return {}


def write_state(path: Path, state: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"{key}={value}" for key, value in state.items()]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def remove_state(path: Path) -> None:
    try:
        path.unlink()
    except FileNotFoundError:
        pass


def next_command(frontend_dir: Path, port: int) -> list[str]:
    next_bin = frontend_dir / "node_modules" / ".bin" / "next"
    if next_bin.exists():
      return [str(next_bin), "dev", "--hostname", "127.0.0.1", "--port", str(port)]
    return ["npm", "run", "dev", "--", "--hostname", "127.0.0.1", "--port", str(port)]


def cmd_start(args: argparse.Namespace) -> int:
    state_path = Path(args.state_file)
    state = read_state(state_path)
    pid = int(state.get("FRONTEND_SMOKE_SERVER_PID", 0) or 0)
    if pid_alive(pid) or url_alive(args.port):
        return 0

    frontend_dir = Path(args.frontend_dir)
    env = os.environ.copy()
    env["NEXT_PUBLIC_SMOKE_TEST_MODE"] = "1"
    env["NEXT_DIST_DIR"] = args.dist_dir
    if args.restore_report:
        env["NEXT_PUBLIC_SMOKE_RESTORE_REPORT"] = "1"
    else:
        env.pop("NEXT_PUBLIC_SMOKE_RESTORE_REPORT", None)

    log_path = Path(args.log_file)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("ab") as log_file:
        proc = subprocess.Popen(
            next_command(frontend_dir, args.port),
            cwd=frontend_dir,
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )

    write_state(
        state_path,
        {
            "FRONTEND_SMOKE_SERVER_PID": proc.pid,
            "FRONTEND_SMOKE_SERVER_PORT": args.port,
            "FRONTEND_SMOKE_SERVER_LOG": args.log_file,
            "FRONTEND_SMOKE_SERVER_DIST_DIR": args.dist_dir,
            "FRONTEND_SMOKE_SERVER_STARTED_AT": int(time.time()),
        },
    )
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    state = read_state(Path(args.state_file))
    pid = int(state.get("FRONTEND_SMOKE_SERVER_PID", 0) or 0)
    port = int(state.get("FRONTEND_SMOKE_SERVER_PORT", args.port) or args.port)
    if pid_alive(pid) or url_alive(port):
        return 0
    return 1


def cmd_stop(args: argparse.Namespace) -> int:
    state_path = Path(args.state_file)
    state = read_state(state_path)
    pid = int(state.get("FRONTEND_SMOKE_SERVER_PID", 0) or 0)
    if pid_alive(pid):
        try:
            os.killpg(pid, signal.SIGTERM)
        except OSError:
            pass
        deadline = time.time() + 3
        while time.time() < deadline:
            if not pid_alive(pid):
                break
            time.sleep(0.1)
        if pid_alive(pid):
            try:
                os.killpg(pid, signal.SIGKILL)
            except OSError:
                pass
    remove_state(state_path)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["start", "status", "stop"])
    parser.add_argument("--state-file", required=True)
    parser.add_argument("--frontend-dir", default="")
    parser.add_argument("--port", type=int, default=3001)
    parser.add_argument("--dist-dir", default="")
    parser.add_argument("--log-file", default="")
    parser.add_argument("--restore-report", action="store_true")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.command == "start":
        return cmd_start(args)
    if args.command == "status":
        return cmd_status(args)
    return cmd_stop(args)


if __name__ == "__main__":
    sys.exit(main())
