import { keccak256, toBytes } from 'viem';
import { DeployL3Input, DeployL3Result } from './orbit.types';

export class OrbitMockClient {
  async deployL3(input: DeployL3Input): Promise<DeployL3Result> {
    const seed = `${input.userWallet.toLowerCase()}-${input.chainId}`;
    const hash = keccak256(toBytes(seed));
    const txHash = '0x' + hash.substring(2, 66);

    return {
      txHash,
      coreContracts: {
        rollup: '0x' + hash.substring(2, 42),
        sequencerInbox: '0x' + hash.substring(10, 50),
        bridge: '0x' + hash.substring(18, 58),
      },
    };
  }
}
