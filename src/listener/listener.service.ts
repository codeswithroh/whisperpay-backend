import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Address, Hash, createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { arbitrum, arbitrumSepolia, mainnet, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { DeploymentRepository } from '../deployment/deployment.repository';

const DEALER_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'string', name: '_backendDigest', type: 'string' },
      { indexed: false, internalType: 'bytes32', name: '_jobDigest', type: 'bytes32' },
      { indexed: true, internalType: 'uint256', name: '_chainId', type: 'uint256' },
      { indexed: false, internalType: 'address', name: '_jobCreator', type: 'address' },
    ],
    name: 'L3Interaction',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: 'uint256', name: '_amount', type: 'uint256' }],
    name: 'FundsTransferredToMediator',
    type: 'event',
  },
  {
    inputs: [{ internalType: 'address', name: '_jobCreator', type: 'address' }],
    name: 'transferToWhisperRouter',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '_jobCreator', type: 'address' }],
    name: 'postOpsUpdate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

@Injectable()
export class ListenerService implements OnModuleInit, OnModuleDestroy {
  private unwatch?: () => void;
  private recentCreators: Address[] = [];

  constructor(private readonly config: ConfigService, private readonly repo: DeploymentRepository) {}

  private mapChain(id: number) {
    const map: Record<number, any> = {
      [arbitrumSepolia.id]: arbitrumSepolia,
      [arbitrum.id]: arbitrum,
      [sepolia.id]: sepolia,
      [mainnet.id]: mainnet,
    };
    return map[id];
  }

  async onModuleInit() {
    const rpc = this.config.get<string>('PARENT_CHAIN_RPC');
    const pk = this.config.get<string>('DEPLOYER_PRIVATE_KEY');
    const addrFromEnv = this.config.get<string>('DEALER_CONTRACT_ADDRESS');

    const address = ((addrFromEnv || '0x59C899f52F2c40cBE5090bbc9A4f830B64a20Fc4') as Address);

    if (!rpc || !pk) {
      return;
    }

    const temp = createPublicClient({ transport: http(rpc) });
    const chainId = await temp.getChainId();
    const viemChain = this.mapChain(chainId);
    if (!viemChain) return;

    const publicClient = createPublicClient({ chain: viemChain, transport: http(rpc) });
    const account = privateKeyToAccount((pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`);
    const walletClient = createWalletClient({ chain: viemChain, transport: http(rpc), account });

    // Listen to L3Interaction and trigger transferToWhisperRouter
    const unwatchL3 = publicClient.watchContractEvent({
      address,
      abi: DEALER_ABI,
      eventName: 'L3Interaction',
      onLogs: async (logs) => {
        for (const log of logs) {
          try {
            const jobCreator = (log as any)?.args?._jobCreator as Address;
            if (!jobCreator) continue;
            this.recentCreators.push(jobCreator);
            await walletClient.writeContract({
              chain: viemChain,
              address,
              abi: DEALER_ABI,
              functionName: 'transferToWhisperRouter',
              args: [jobCreator],
            });
          } catch (_) {}
        }
      },
    });

    // Listen to FundsTransferredToMediator and then perform internal transfers + postOpsUpdate
    const unwatchFunds = publicClient.watchContractEvent({
      address,
      abi: DEALER_ABI,
      eventName: 'FundsTransferredToMediator',
      onLogs: async () => {
        // Pick the latest creator we acted on
        const jobCreator = this.recentCreators.shift();
        if (!jobCreator) return;
        try {
          // Fetch pending mapping by wallet
          const pending = await this.repo.findPendingByWallet(jobCreator);
          if (pending?.items?.length) {
            for (const it of pending.items as any[]) {
              try {
                await walletClient.sendTransaction({
                  chain: viemChain,
                  account,
                  to: it.recipient as Address,
                  value: parseEther(it.amount),
                });
              } catch (_) {}
            }
          }

          // Call postOpsUpdate with jobCreator
          try {
            await walletClient.writeContract({
              chain: viemChain,
              address,
              abi: DEALER_ABI,
              functionName: 'postOpsUpdate',
              args: [jobCreator],
            });
          } catch (_) {}

          // Mark transaction(s) completed for this user
          const user = await this.repo.findUserByWallet(jobCreator);
          if (user) await this.repo.completeByUserId((user as any)._id);
        } catch (_) {}
      },
    });

    this.unwatch = () => {
      try { unwatchL3(); } catch {}
      try { unwatchFunds(); } catch {}
    };
  }

  onModuleDestroy() {
    try { this.unwatch?.(); } catch {}
  }
}
