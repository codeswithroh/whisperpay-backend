import { IsString } from 'class-validator';

export class DeployL3Dto {
  @IsString()
  userWallet!: string;
}
