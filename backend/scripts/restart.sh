#!/bin/sh
# Arrête l'ancienne instance puis relance le serveur, pour être sûr que le NOUVEAU code tourne.
# Usage (dossier backend) : sh scripts/restart.sh
cd "$(dirname "$0")/.." || exit 1
pkill -f "node src/index.js" 2>/dev/null
sleep 1
nohup node src/index.js >> server.log 2>&1 &
sleep 3
echo "Réponse de /health :"
curl -s "http://127.0.0.1:${PORT:-4000}/health" || echo "Le serveur ne répond pas : voir server.log"
echo
