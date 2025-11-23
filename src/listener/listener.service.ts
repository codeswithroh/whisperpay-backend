import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Address, createPublicClient, createWalletClient, http } from 'viem';
import { arbitrum, arbitrumSepolia, mainnet, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

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
    inputs: [{ internalType: 'address', name: '_jobCreator', type: 'address' }],
    name: 'transferToWhisperRouter',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

@Injectable()
export class ListenerService implements OnModuleInit, OnModuleDestroy {
  private unwatch?: () => void;

  constructor(private readonly config: ConfigService) {}

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
    const pk = this.config.get<string>('DEALER_PRIVATE_KEY');
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

    this.unwatch = publicClient.watchContractEvent({
      address,
      abi: DEALER_ABI,
      eventName: 'L3Interaction',
      onLogs: async (logs) => {
        for (const log of logs) {
          try {
            const jobCreator = (log as any)?.args?._jobCreator as Address;
            if (!jobCreator) continue;
            await walletClient.writeContract({
              chain: viemChain,
              address,
              abi: DEALER_ABI,
              functionName: 'transferToWhisperRouter',
              args: [jobCreator],
            });
          } catch (_) {
          }
        }
      },
    });
  }

  onModuleDestroy() {
    try { this.unwatch?.(); } catch {}
  }
}
