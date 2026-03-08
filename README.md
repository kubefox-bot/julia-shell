# JuliaApp Monorepo

Stage 1 monorepo layout:

- `apps/server` - Astro SSR shell + widget APIs + agent control core.
- `apps/agent` - Rust agent runtime (Linux/macOS/Windows).
- `packages/protocol` - gRPC/protobuf contracts.

## Workspace commands

```bash
yarn install

yarn dev            # server dev
yarn build          # server build
yarn test           # server tests

yarn check:protocol # proto syntax/check

yarn check:agent    # cargo check (agent)
yarn build:agent    # cargo build (agent)
```

## Data path (Podman)

Server runtime data is expected under host path:

- `/mnt/ostree/podman/julia-shell`

See `apps/server/podman-compose.yml` for bind mounts and env vars.
