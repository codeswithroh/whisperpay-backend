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
    console.log('Listener ready', { chainId, address });

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
            try {
              console.log('L3Interaction received', {
                jobCreator,
                backendDigest: (log as any)?.args?._backendDigest,
                jobDigest: (log as any)?.args?._jobDigest,
                chainId: (log as any)?.args?._chainId?.toString?.() ?? (log as any)?.args?._chainId,
              });
            } catch {}
            console.log('Calling transferToWhisperRouter', { jobCreator });
            try {
              const txHash = await walletClient.writeContract({
                chain: viemChain,
                address,
                abi: DEALER_ABI,
                functionName: 'transferToWhisperRouter',
                args: [jobCreator],
              });
              try { console.log('transferToWhisperRouter tx', txHash); } catch {}
              try { this.recentCreators.push(jobCreator); } catch {}
            } catch (e: any) {
              try {
                console.error('transferToWhisperRouter error', {
                  jobCreator,
                  message: e?.shortMessage || e?.message,
                  name: e?.name,
                });
              } catch {}
            }
          } catch (_) {}
        }
      },
    });

    // Listen to FundsTransferredToMediator and then perform internal transfers + postOpsUpdate
    const unwatchFunds = publicClient.watchContractEvent({
      address,
      abi: DEALER_ABI,
      eventName: 'FundsTransferredToMediator',
      onLogs: async (logs) => {
        try {
          for (const log of logs as any[]) {
            const amt = (log as any)?.args?._amount;
            console.log('FundsTransferredToMediator received. amount =', amt?.toString?.() ?? amt);
          }
        } catch {}
        // Pick the latest creator we acted on
        const jobCreator = this.recentCreators.pop();
        try { console.log('Selected jobCreator for settlement', jobCreator); } catch {}
        if (!jobCreator) {
          try { console.warn('No jobCreator queued for settlement'); } catch {}
          return;
        }
        try {
          // Fetch pending mapping by wallet
          const pending = await this.repo.findPendingByWallet(jobCreator);
          const count = pending?.items?.length ?? 0;
          try { console.log('Pending transfers found', { count }); } catch {}
          if (count) {
            for (const it of (pending?.items ?? []) as any[]) {
              try {
                const ptx = await walletClient.sendTransaction({
                  chain: viemChain,
                  account,
                  to: it.recipient as Address,
                  value: parseEther(it.amount),
                });
                try { console.log('Internal transfer tx', ptx); } catch {}
              } catch (_) {}
            }
          }

          // Call postOpsUpdate with jobCreator
          try {
            console.log('Calling postOpsUpdate', { jobCreator });
            const upHash = await walletClient.writeContract({
              chain: viemChain,
              address,
              abi: DEALER_ABI,
              functionName: 'postOpsUpdate',
              args: [jobCreator],
            });
            try { console.log('postOpsUpdate tx', upHash); } catch {}
          } catch (_) {}

          // Mark transaction(s) completed for this user
          const user = await this.repo.findUserByWallet(jobCreator);
          if (user) {
            await this.repo.completeByUserId((user as any)._id);
            try { console.log('Marked transactions completed for user', (user as any)._id); } catch {}
          }
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

  // Exposed API helper to trigger transferToWhisperRouter manually
  async triggerTransfer(inputJobCreator?: Address) {
    const rpc = this.config.get<string>('PARENT_CHAIN_RPC');
    const pk = this.config.get<string>('DEPLOYER_PRIVATE_KEY');
    const addrFromEnv = this.config.get<string>('DEALER_CONTRACT_ADDRESS');

    const address = ((addrFromEnv || '0x59C899f52F2c40cBE5090bbc9A4f830B64a20Fc4') as Address);
    const jobCreator = (inputJobCreator || ('0x2bEb0e1fD3430E8655624A7FCB4E8820397551f8' as Address));

    if (!rpc || !pk) {
      console.error('triggerTransfer failed: missing RPC or PK');
      throw new Error('Missing RPC or private key');
    }

    try {
      const temp = createPublicClient({ transport: http(rpc) });
      const chainId = await temp.getChainId();
      const viemChain = this.mapChain(chainId);
      if (!viemChain) throw new Error(`Parent chain not supported: ${chainId}`);

      const account = privateKeyToAccount((pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`);
      const walletClient = createWalletClient({ chain: viemChain, transport: http(rpc), account });

      console.log('API Calling transferToWhisperRouter', { jobCreator, chainId, address });
      const txHash = await walletClient.writeContract({
        chain: viemChain,
        address,
        abi: DEALER_ABI,
        functionName: 'transferToWhisperRouter',
        args: [jobCreator],
      });
      try { console.log('API transferToWhisperRouter tx', txHash); } catch {}
      return { txHash };
    } catch (e: any) {
      try {
        console.error('transferToWhisperRouter error', {
          jobCreator,
          message: e?.shortMessage || e?.message,
          name: e?.name,
          stack: e?.stack,
          cause: e?.cause,
          data: e,
        });
      } catch {}
      throw e;
    }
  }
}
