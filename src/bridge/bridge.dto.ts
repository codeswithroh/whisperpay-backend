export class BridgeRequestDto {
  token!: string; // e.g., 'eth'
  amount!: string; // decimal string in ETH, e.g., '0.01'
  to!: string; // recipient on L3
}
