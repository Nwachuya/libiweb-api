#!/bin/bash
set -e

# Start fused backend on localhost — internal only, not exposed
(cd apimink/fused-backend && uvicorn main:app --host 127.0.0.1 --port 8001) &

# Start Node.js API as the web process
node src/index.js
