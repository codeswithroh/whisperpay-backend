# WhisperPay Backend

NestJS service to deploy a per-user Arbitrum Orbit L3, based on `PRD.md`.

## Endpoints

- POST `/deploy-l3`

```json
{
  "userWallet": "0xabc..."
}
```

## Run (mocked Orbit)

1. Copy `.env.example` to `.env` and set `USE_MOCK_ORBIT=true`.
2. Install deps: `npm i`.
3. Start dev: `npm run dev`.

## Env

- `PARENT_CHAIN_RPC`
- `DEPLOYER_PRIVATE_KEY`
- `BACKEND_OWNER_ADDRESS`
- `BACKEND_VALIDATOR_ADDRESS`
- `BACKEND_BATCH_POSTER_ADDRESS`
- `PORT` (default 3000)
- `USE_MOCK_ORBIT` (true/false)

## Structure

- `src/app.module.ts`
- `src/deployment/`
  - `deployment.controller.ts`
  - `deployment.service.ts`
  - `deployment.repository.ts`
  - `dto/deploy-l3.dto.ts`
- `src/orbit/`
  - `orbit.module.ts`
  - `orbit.service.ts`
  - `orbit.mock.ts`
  - `orbit.types.ts`

## Notes

- When `USE_MOCK_ORBIT=false`, the Orbit SDK integration must be implemented in `orbit.service.ts`.
- Deployments are stored in `data/l3_deployments.json`.
