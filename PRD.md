# PRD: Backend System to Deploy a New L3 per User Wallet Using Arbitrum Orbit SDK

## 1. Goal

Build a NestJS backend that receives a user wallet address and deploys a fresh Orbit L3 chain for that user. The backend uses the Arbitrum Orbit SDK to programmatically deploy a Rollup or AnyTrust chain. The backend will only handle the L3 deployment step for now. No burner wallet creation in this version.

## 2. Main Function

**POST /deploy-l3**

Input:

```
{
  "userWallet": "0xabc..."
}
```

Output (success):

```
{
  "status": "ok",
  "l3ChainId": "...",
  "coreContracts": {
    "rollup": "...",
    "sequencerInbox": "...",
    "bridge": "..."
  },
  "txHash": "..."
}
```

Output (error):

```
{
  "status": "error",
  "message": "..."
}
```

## 3. High Level Flow

1. API receives a wallet address.
2. Backend creates a unique chainId for this user or uses a generator.
3. Backend uses Orbit SDK:

   * prepareChainConfig
   * createRollupPrepareDeploymentParamsConfig
   * createRollup
4. The SDK deploys the L3 contracts on the parent chain (Arbitrum One or Sepolia).
5. Backend stores the deployment metadata.
6. Response is returned to the client.

## 4. Detailed Flow for Implementation

### Step 1: Generate a chainId

Requirement:

* Produce a unique integer chainId per user.
* Example strategy: hash(wallet) mod a large number or use a database auto increment.

### Step 2: Build chainConfig object

Use Orbit SDK:

```
prepareChainConfig({
  chainId,
  arbitrum: {
    InitialChainOwner: backendOwnerWallet,
    DataAvailabilityCommittee: false
  }
})
```

### Step 3: Build Config struct

Use:

```
createRollupPrepareDeploymentParamsConfig(parentPublicClient, {
  chainId,
  owner: backendOwnerWallet,
  chainConfig: chainConfigResult
})
```

Parent chain:

* Use viem
* Transport http
* Choose Arbitrum One or Sepolia

### Step 4: Call createRollup

```
createRollup({
  params: {
    config: createRollupConfig,
    batchPosters: [backendPosterWallet],
    validators: [backendValidatorWallet]
  },
  account: deployer,
  parentChainPublicClient
})
```

Outputs:

* transaction
* transactionReceipt
* coreContracts

### Step 5: Persistence

Store in a new table:
Table: l3_deployments

Fields:

* id
* userWallet
* chainId
* txHash
* coreContracts json
* createdAt timestamp

## 5. NestJS Requirements

### Modules

* DeploymentModule
* DeploymentService
* DeploymentController

### Service responsibilities

* Generate chainId
* Interact with Orbit SDK
* Handle errors
* Return structured response

### Controller responsibilities

* Validate input
* Call service
* Return output

### Config

* env vars:

  * PARENT_CHAIN_RPC
  * DEPLOYER_PRIVATE_KEY
  * BACKEND_OWNER_ADDRESS
  * BACKEND_VALIDATOR_ADDRESS
  * BACKEND_BATCH_POSTER_ADDRESS

## 6. Security

* Verify input is a valid EVM address.
* Private key must never be logged.
* Rate limit calls.
* Optionally implement signature validation to prove user owns the wallet.

## 7. Error Cases

* Parent chain RPC failure.
* Insufficient gas for deployment.
* Invalid wallet address.
* Orbit SDK internal errors.

Backend must return clear error messages.

## 8. Success Criteria

* Backend can deploy a fresh Orbit L3 chain on command.
* ChainId is consistent and traceable per user.
* Deployment metadata stored correctly.
* API returns contract addresses.

## 9. Future Extensions

* Automatic burner wallet contract deployment inside L3.
* Receiver distribution logic.
* Scheduled payouts.
* L3 specific RPC bootstrapping.

---

If you want, I can now generate:

* A full NestJS folder structure.
* The actual TypeScript code for controller, service, DTO, and Orbit integration.
* A mock implementation that returns fake contract addresses for local testing.
