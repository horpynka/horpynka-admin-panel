#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/horpynka-admin-panel}"
GIT_REF="${GIT_REF:-main}"
VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://horpynka.com/api}"

cd "${DEPLOY_PATH}"

git fetch origin "${GIT_REF}"
git checkout "${GIT_REF}"
git reset --hard "origin/${GIT_REF}"

docker compose build --pull
docker compose up -d --remove-orphans

docker image prune -f

docker compose ps
