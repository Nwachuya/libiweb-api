#!/bin/bash
set -e

# Start fused backend using the isolated virtualenv
(cd apimink/fused-backend && /opt/fused-venv/bin/uvicorn main:app --host 127.0.0.1 --port 8001) &

# Start Node.js API as the web process
node src/index.js
