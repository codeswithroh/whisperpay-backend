import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicClient, http, isAddress } from 'viem';
import { arbitrum, arbitrumSepolia, mainnet, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as Chain from '@arbitrum/chain-sdk';
import { DeployL3Input, DeployL3Result } from './orbit.types';
import { OrbitMockClient } from './orbit.mock';

@Injectable()
export class OrbitService {
  private useMock: boolean;

  constructor(private readonly config: ConfigService) {
    this.useMock = this.config.get('USE_MOCK_ORBIT') === 'true';
  }

  async deployL3(input: DeployL3Input): Promise<DeployL3Result> {
    if (this.useMock) {
      const mock = new OrbitMockClient();
      return mock.deployL3(input);
    }

    const rpc = this.config.get<string>('PARENT_CHAIN_RPC');
    const privateKey = this.config.get<string>('DEPLOYER_PRIVATE_KEY');
    const owner = this.config.get<string>('BACKEND_OWNER_ADDRESS');
    const validator = this.config.get<string>('BACKEND_VALIDATOR_ADDRESS');
    const poster = this.config.get<string>('BACKEND_BATCH_POSTER_ADDRESS');

    if (!rpc || !privateKey || !owner || !validator || !poster) {
      throw new Error('Missing required env config for Orbit deployment');
    }

    const pk = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    if (!isAddress(owner) || !isAddress(validator) || !isAddress(poster)) {
      throw new Error('One or more configured addresses are invalid');
    }

    // Use a temporary client to read the chainId, then create a typed client with the proper chain.
    const tempClient = createPublicClient({ transport: http(rpc) });
    const parentChainId = await tempClient.getChainId();

    const chainMap: Record<number, any> = {
      [arbitrumSepolia.id]: arbitrumSepolia,
      [arbitrum.id]: arbitrum,
      [sepolia.id]: sepolia,
      [mainnet.id]: mainnet,
    };

    const viemChain = chainMap[parentChainId as number];
    if (!viemChain) {
      throw new Error(`Parent chain not supported: ${parentChainId}`);
    }

    const parentChainPublicClient = createPublicClient({ chain: viemChain, transport: http(rpc) });

    const account = privateKeyToAccount(pk as `0x${string}`);

    // 1) Prepare chain config
    const chainConfig = await Chain.prepareChainConfig({
      chainId: input.chainId,
      arbitrum: {
        InitialChainOwner: owner,
        DataAvailabilityCommittee: false,
      },
    });

    // 2) Prepare rollup deployment config
    const rollupConfig = await Chain.createRollupPrepareDeploymentParamsConfig(
      parentChainPublicClient,
      {
        chainId: BigInt(input.chainId),
        owner,
        chainConfig,
      },
    );

    // 3) Deploy rollup
    const result = await Chain.createRollup({
      params: {
        config: rollupConfig,
        batchPosters: [poster],
        validators: [validator],
      },
      account,
      parentChainPublicClient,
    });

    const txHash = (result as any)?.transaction?.hash || (result as any)?.transactionHash;
    const coreContracts = (result as any)?.coreContracts ?? {};

    if (!txHash) {
      throw new Error('Deployment did not return a transaction hash');
    }

    return {
      txHash,
      coreContracts,
    };
  }
}
