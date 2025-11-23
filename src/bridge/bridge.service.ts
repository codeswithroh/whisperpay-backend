import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeploymentRepository } from '../deployment/deployment.repository';
import { BridgeRequestDto } from './bridge.dto';
import { Address, createPublicClient, createWalletClient, http, isAddress, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrum, arbitrumSepolia, mainnet, sepolia } from 'viem/chains';

const INBOX_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "l2CallValue", "type": "uint256" },
      { "internalType": "uint256", "name": "maxSubmissionCost", "type": "uint256" },
      { "internalType": "address", "name": "excessFeeRefundAddress", "type": "address" },
      { "internalType": "address", "name": "callValueRefundAddress", "type": "address" },
      { "internalType": "uint256", "name": "gasLimit", "type": "uint256" },
      { "internalType": "uint256", "name": "maxFeePerGas", "type": "uint256" },
      { "internalType": "bytes", "name": "data", "type": "bytes" }
    ],
    "name": "createRetryableTicket",
    "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ],
    "stateMutability": "payable",
    "type": "function"
  }
] as const;

@Injectable()
export class BridgeService {
  constructor(
    private readonly config: ConfigService,
    private readonly repo: DeploymentRepository,
  ) {}

  private mapChain(id: number) {
    const map: Record<number, any> = {
      [arbitrumSepolia.id]: arbitrumSepolia,
      [arbitrum.id]: arbitrum,
      [sepolia.id]: sepolia,
      [mainnet.id]: mainnet,
    };
    return map[id];
  }

  async bridgeToL3(dto: BridgeRequestDto) {
    if ((dto.token || '').toLowerCase() !== 'eth') throw new BadRequestException('Only ETH supported currently');
    if (!dto.amount) throw new BadRequestException('amount is required');
    if (!isAddress(dto.to)) throw new BadRequestException('to must be a valid address');

    const latest = await this.repo.getLatest();
    if (!latest) throw new BadRequestException('No L3 deployment found');

    const inbox = latest.coreContracts?.inbox as Address | undefined;
    if (!inbox) throw new BadRequestException('Inbox address not found');

    const rpc = this.config.get<string>('PARENT_CHAIN_RPC');
    const pk = this.config.get<string>('DEPLOYER_PRIVATE_KEY');
    if (!rpc || !pk) throw new InternalServerErrorException('Missing RPC or private key');

    const tempClient = createPublicClient({ transport: http(rpc) });
    const chainId = await tempClient.getChainId();
    const viemChain = this.mapChain(chainId);
    if (!viemChain) throw new InternalServerErrorException(`Parent chain not supported: ${chainId}`);

    const publicClient = createPublicClient({ chain: viemChain, transport: http(rpc) });

    const account = privateKeyToAccount((pk.startsWith('0x') ? pk : `0x${pk}`) as `0x${string}`);
    const walletClient = createWalletClient({ chain: viemChain, transport: http(rpc), account });

    const l2CallValue = parseEther(dto.amount);
    const data = '0x';
    const dataLength = BigInt((data.length - 2) / 2);

    const block = await publicClient.getBlock({ blockTag: 'latest' });
    const base = block.baseFeePerGas ?? (await publicClient.getGasPrice());
    const priority = base / 10n > 10_000_000n ? base / 10n : 10_000_000n; // at least 0.01 gwei
    const txMaxFeePerGas = base * 2n + priority;

    const gasLimit = 1_500_000n; // allow headroom
    const maxSubmissionCost = (base || 1n) * (dataLength + 5000n); // bigger buffer
    const value = l2CallValue + maxSubmissionCost + gasLimit * txMaxFeePerGas;

    const txHash = await walletClient.writeContract({
      chain: viemChain,
      address: inbox,
      abi: INBOX_ABI,
      functionName: 'createRetryableTicket',
      args: [
        dto.to as Address,
        l2CallValue,
        maxSubmissionCost,
        account.address,
        account.address,
        gasLimit,
        txMaxFeePerGas,
        data as `0x${string}`,
      ],
      value,
      gas: gasLimit,
      maxFeePerGas: txMaxFeePerGas,
      maxPriorityFeePerGas: priority,
    });

    return { submissionStatus: 'submitted', l3ChainId: String(latest.chainId), inbox, txHash };
  }
}
