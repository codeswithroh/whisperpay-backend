export interface DeployL3Input {
  userWallet: string;
  chainId: number;
}

export interface DeployL3Result {
  txHash: string;
  coreContracts: Record<string, string>;
}

export interface OrbitClient {
  deployL3(input: DeployL3Input): Promise<DeployL3Result>;
}
