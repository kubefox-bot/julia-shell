# JuliaApp Monorepo

Stage 1 monorepo layout:

- `apps/server` - Astro SSR shell + widget APIs + agent control core.
- `apps/agent` - Rust agent runtime (Linux/macOS/Windows).
- `packages/protocol` - gRPC/protobuf contracts.

## Monorepo usage

All commands are run from repository root: `/Users/evgeniyscherbina/WORKING/PET/JuliaApp`.

Typical flow:
1. Install deps once: `yarn install`
2. Develop server UI/API: `yarn dev`
3. Check contracts: `yarn check:protocol`
4. Check agent build: `yarn check:agent`
5. Run server tests: `yarn test`
6. Build server: `yarn build`

## Workspace commands

```bash
yarn install

yarn dev            # @julia/server dev
yarn build          # @julia/server build
yarn test           # @julia/server tests

yarn check:protocol # proto syntax/check

yarn check:agent    # cargo check (apps/agent)
yarn build:agent    # cargo build (apps/agent)

# explicit workspace calls (optional)
yarn workspace @julia/server dev
yarn workspace @julia/server typecheck
yarn workspace @julia/server test
yarn workspace @julia/server build
```

## Repo responsibilities

- `apps/server`: Astro shell, HTTP APIs, gRPC ingress, SQLite DB files under configured data dir.
- `apps/agent`: Rust cross-platform agent (Windows/Linux/macOS).
- `packages/protocol`: `agent_control.proto` and protocol checks/codegen inputs.

## Data path (Podman)

Server runtime data is expected under host path:

- `/mnt/ostree/podman/julia-shell`

See `apps/server/podman-compose.yml` for bind mounts and env vars.
