# DEPLOY — ASADO.MAKER on DigitalOcean

Two droplets in TOR1 on one VPC:

```
static (same origin as API)          GPU box (0.76/hr, training + serving)
└── nginx/Caddy: 443 /api → :4000    └── llama-server :8080 (Qwen3-VL-4B)
         ▼                                   ▲
   asado-api :4000 (axum) ── private VPC ────┘ firewall: 8080 allowed from API droplet only
```

The GPU box is the only expensive object. Create it per run, destroy it when done.

## Prereqs

- `doctl auth init` (write scope).
- One VPC in `tor1`; note its UUID (`doctl compute vpc list`).
- One SSH key: `doctl compute ssh-key list --format ID,Name`.
- The fine-tuned model from the ML pipeline (`docs/DATASET.md`):
  `asado-v0-Q4_K_M.gguf` + `mmproj-f16.gguf`.

## 1. API droplet (always on, ~$24/mo)

```bash
doctl compute droplet create asado-api --image ubuntu-24-04 --size s-2vcpu-4gb \
  --region tor1 --vpc-uuid "$DO_VPC_ID" --ssh-keys "$DO_SSH_KEY_ID" \
  --tag-names asado-api --wait
```

On the box:

```bash
useradd -r -m asado; mkdir -p /opt/asado /etc/asado
# build a release binary locally and copy it up
cargo build --release --manifest-path api/Cargo.toml
scp api/target/release/asado-api root@<ip>:/opt/asado/     # cross-compile or scp artifact

cat > /etc/asado/api.env <<'EOF'
BIND=0.0.0.0:4000
MODEL_URL=http://<gpu-private-ip>:8080/v1
MODEL_API_KEY=<long random>            # same as the GPU box's LLAMA_API_KEY
MODEL_NAME=asado-4b
RUST_LOG=asado_api=info,tower_http=info
# SPACES_ENDPOINT / SPACES_REGION / SPACES_BUCKET / SPACES_KEY / SPACES_SECRET / SPACES_PUBLIC_BASE
EOF
chmod 600 /etc/asado/api.env
install -o asado -g asado deploy/asado-api.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now asado-api
curl -s localhost:4000/api/health
```

Mock check: with `MODEL_URL` unset, `/api/health` reports `"model": "mock"` and
`/cook/analyze` returns canned output — the app is fully testable with no GPU box.

## 2. Static PWA, same origin

Serve `app/dist` behind the API origin so the SPA's relative `/api` calls work:

- Build: `pnpm -C app build`, copy `app/dist/*` to the API droplet.
- Caddy adds TLS on the same host and proxies `/api/*` to `127.0.0.1:4000`:

```caddyfile
asado.maker {
    root * /opt/asado/dist
    encode gzip
    handle_path /api/* {
        reverse_proxy 127.0.0.1:4000
    }
    handle {
        try_files {path} /index.html
    }
}
```

or skip TLS and use DO's managed load balancer with a TLS cert (adds ~$20/mo —
Caddy with Let's Encrypt is free on the same droplet).

## 3. GPU box (per-run)

```bash
export DO_VPC_ID=... DO_SSH_KEY_ID=... API_PRIVATE_IP=<asado-api private v4>
./deploy/gpu-provision.sh
```

The script creates the droplet, tags it, and installs a cloud firewall where
`tcp/8080` is allowed **only from the API droplet's private IP** (SSH from anywhere).
It then prints the post-provision steps: build llama.cpp, copy the GGUFs,
`install deploy/llama-server.service`, enable it.

Verify end to end from the API droplet:

```bash
curl --fail -H "Authorization: Bearer $MODEL_API_KEY" \
  http://<gpu-private-ip>:8080/health
```

Service is `llama-server` with `--jinja` (Qwen3-VL chat template), 25s client
timeout, one retry, JSON-schema output (`response_format`) for `/cook/analyze`.
If it is ever unreachable the API degrades to the offline advisor instead of
erroring.

## 4. Train / iterate

Spin the GPU box up, run the Unsloth run + `merge_quantize.sh` on it (see
`docs/DATASET.md`), copy `asado-v<N>*.gguf` back to the API droplet's `/opt/models`,
point the service at the new files, `systemctl restart llama-server`, then gate on
`ml/eval/score.py` vs base before rolling.

## Billing — destroy, never power off

| Object | Cost | Notes |
|---|---|---|
| API droplet s-2vcpu-4gb | ~$24/mo | always on |
| GPU gpu-rtx4000x1-20gb | $0.76/hr | **power-off still bills; destroy stops it** |
| Training run | $0.76/hr × 1–3 h | one box per run |
| Later: GPU pool scale-to-zero | — | only if traffic grows |

When the GPU box is idle:

```bash
./deploy/gpu-destroy.sh asado-gpu
```

Keep the adapter + merged weights + GGUFs on the API droplet (or a bucket) first —
`ml/out` is gitignored by design.

## Security checklist

- `--api-key` on llama-server; never expose 8080 publicly (firewall restricts to
  the API droplet's private IP).
- Model keys live in `/etc/asado/*.env`, mode 600, non-root service users.
- Feed is anonymous; rate-limited per IP (12/min live) with report + moderation.
  V1 keeps the feed in-memory — the `SPACES_*` env vars are reserved for the
  S3-backed feed (photos, handles, reports) when it grows.