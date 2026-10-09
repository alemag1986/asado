#!/usr/bin/env bash
# Provision the GPU droplet used for training/serving, with a firewall that
# exposes llama-server (tcp/8080) only to the API droplet's private IP.
#
# Prereqs: `doctl auth init` (write scope), and an existing VPC + SSH key.
#
#   export DO_VPC_ID=<vpc-uuid>
#   export DO_SSH_KEY_ID=<key-id>
#   export API_PRIVATE_IP=<private v4 of the API droplet>
#   ./deploy/gpu-provision.sh
#
# After it finishes, the script lists the post-provision steps (install
# llama.cpp, drop the model files, enable the systemd unit).
set -euo pipefail

REGION="${DO_REGION:-tor1}"
SIZE="${DO_GPU_SIZE:-gpu-rtx4000x1-20gb}"
NAME="${DO_GPU_NAME:-asado-gpu}"
TAG="asado-gpu"
FW="asado-gpu-fw"

: "${DO_VPC_ID:?set DO_VPC_ID (uuid)}"
: "${DO_SSH_KEY_ID:?set DO_SSH_KEY_ID}"

function droplet_ip() {
  doctl compute droplet get "$NAME" --format PublicIPv4 --no-header
}

echo "==> creating $NAME ($SIZE) in $REGION"
doctl compute droplet create "$NAME" \
  --image ubuntu-24-04 --size "$SIZE" --region "$REGION" \
  --vpc-uuid "$DO_VPC_ID" --ssh-keys "$DO_SSH_KEY_ID" \
  --tag-names "$TAG" --wait

PUBLIC_IP="$(droplet_ip)"
echo "==> droplet $NAME up at $PUBLIC_IP"

echo "==> creating firewall $FW"
doctl compute firewall create --name "$FW" \
  --inbound-rules "protocol:tcp,ports:22,address:0.0.0.0/0,address:::/0" \
                  "protocol:tcp,ports:8080,address:${API_PRIVATE_IP}" \
  --tag-names "$TAG" >/dev/null

echo
echo "==> done. GPU billing runs $0.76/hr until you destroy it."
echo
echo "Post-provision steps:"
echo "  ssh root@$PUBLIC_IP   # then:"
echo "    useradd -r -m llama; mkdir -p /etc/asado /opt/models /opt/llama.cpp"
echo "    apt-get update && apt-get install -y cmake build-essential curl git"
echo "    git clone https://github.com/ggerganov/llama.cpp /opt/llama.cpp"
echo "    cmake -B /opt/llama.cpp/build -DLLAMA_CURL=ON /opt/llama.cpp && cmake --build /opt/llama.cpp/build --target llama-server -j"
echo "    # copy asado-v0-Q4_K_M.gguf + mmproj-f16.gguf (training output) to /opt/models/"
echo "    echo 'LLAMA_API_KEY=<long random>' > /etc/asado/llama.env; chmod 600 /etc/asado/llama.env"
echo "    install -o llama -g llama deploy/llama-server.service /etc/systemd/system/"
echo "    systemctl daemon-reload && systemctl enable --now llama-server"
echo "    curl --fail http://127.0.0.1:8080/health"
echo "Firewall check: 8080 is only reachable from ${API_PRIVATE_IP}."
echo "When idle: run ./deploy/gpu-destroy.sh (a power-off still bills)."