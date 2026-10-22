# Contributing to Consentry

Thanks for helping make agents trustworthy.

```bash
pnpm install
pnpm dev                       # gateway :8787 + Vite :5173 with hot reload
pnpm test                      # unit tests
pnpm tsx scripts/smoke.ts      # every scenario + red-team attack against live APIs
```

## Good first contributions

- **New public-data tools** in `packages/core/src/tools/public.ts`: declare `recipientId`, `purpose` and `requiredArgs`, and keep the returned data compact.
- **New minimizers** in `transforms.ts`, with tests in `packages/core/test/core.test.ts`.
- **New red-team scenarios** in `redteam.ts`. A scenario must run through the real runtime.
- **Policy compiler phrases** in `policy.ts`.

## Principles

1. Every outbound byte goes through `ConsentryRuntime.callTool()` or `inspectLLMText()`. No side doors.
2. The ledger never stores raw personal data.
3. The core stays isomorphic (no Node-only APIs in `packages/core`).
4. Simulated partners are always labeled as simulated.
