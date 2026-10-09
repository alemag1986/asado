#!/usr/bin/env bash
# Destroy the GPU droplet. Destroy, never power off: a stopped GPU droplet keeps
# billing, a destroyed one stops. Adapter, merged weights and GGUFs must already
# be saved elsewhere (ml/out on the API droplet or a bucket) before destroying.
#
#   ./deploy/gpu-destroy.sh [droplet-name]
set -euo pipefail

NAME="${1:-asado-gpu}"

ID="$(doctl compute droplet get "$NAME" --format ID --no-header)"
echo "==> destroying $NAME ($ID)"
doctl compute droplet delete "$ID" --force
echo "==> destroyed; GPU billing stopped."

echo "Also remove the firewall (reference only, not automatic):"
echo "  doctl compute firewall get asado-gpu-fw --format ID --no-header"
echo "  doctl compute firewall delete <id> --force"