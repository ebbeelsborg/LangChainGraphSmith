#!/bin/bash
set -e
export PATH="/home/runner/workspace/.pythonlibs/bin:$PATH"
cd /home/runner/workspace/artifacts/api-server
exec uvicorn app:app --host 0.0.0.0 --port "${PORT:-8080}" --reload --log-level info
