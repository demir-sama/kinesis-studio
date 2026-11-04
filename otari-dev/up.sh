#!/usr/bin/env bash
# Bring up a local Otari + sandbox + SearXNG + Ollama on the host network.
# Usage: source otari-dev/.env.local (OTARI_MASTER_KEY, KINESIS_SERVICE_KEY, OTARI_PROVIDER_ACCOUNT_PEPPER) && ./otari-dev/up.sh
set -euo pipefail
cd "$(dirname "$0")"
: "${OTARI_MASTER_KEY:?}" "${KINESIS_SERVICE_KEY:?}" "${OTARI_PROVIDER_ACCOUNT_PEPPER:?}"
mkdir -p data searxng && chmod 777 data
[ -f searxng/settings.yml ] || cat > searxng/settings.yml <<'YML'
use_default_settings: true
server: { secret_key: "kinesis-local-dev", limiter: false, bind_address: "127.0.0.1", port: 8181 }
search: { formats: [html, json] }
YML
docker rm -f kin-sandbox kin-searxng kin-otari >/dev/null 2>&1 || true
docker inspect kin-ollama >/dev/null 2>&1 || docker run -d --name kin-ollama --network host -v "$PWD/data/ollama:/root/.ollama" ollama/ollama
docker run -d --name kin-sandbox --network host mzdotai/otari-sandbox-container:latest uvicorn sandbox.exec_server:app --host 127.0.0.1 --port 8180
docker run -d --name kin-searxng --network host -v "$PWD/searxng/settings.yml:/etc/searxng/settings.yml:ro" -e GRANIAN_PORT=8181 -e GRANIAN_HOST=127.0.0.1 -e SEARXNG_BASE_URL=http://127.0.0.1:8181/ searxng/searxng:latest
docker run -d --name kin-otari --network host -v "$PWD/config.yml:/app/config.yml:ro" -v "$PWD/data:/data" \
  -e OTARI_MASTER_KEY -e KINESIS_SERVICE_KEY -e OTARI_PROVIDER_ACCOUNT_PEPPER \
  -e OTARI_SANDBOX_URL=http://127.0.0.1:8180 -e OTARI_WEB_SEARCH_URL=http://127.0.0.1:8181 \
  -e OTARI_HOST=127.0.0.1 -e OTARI_PORT=8000 mzdotai/otari:latest otari serve --config /app/config.yml
echo "Otari on http://127.0.0.1:8000 — set OTARI_BASE_URL=http://127.0.0.1:8000/api/v1 and OTARI_API_KEY=\$KINESIS_SERVICE_KEY"
echo "Models: docker exec kin-ollama ollama pull qwen2.5:1.5b && docker exec kin-ollama ollama pull llama3.2:1b"
