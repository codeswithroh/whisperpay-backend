import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { isAddress, keccak256, toBytes } from 'viem';
import { OrbitService } from '../orbit/orbit.service';
import { DeploymentRepository } from './deployment.repository';
import * as crypto from 'crypto';
import { EncryptPayloadDto } from './dto/encrypt.dto';
import { arbitrumSepolia } from 'viem/chains';

@Injectable()
export class DeploymentService {
  constructor(
    private readonly orbit: OrbitService,
    private readonly repo: DeploymentRepository,
  ) {}

  private generateChainId(userWallet: string): number {
    const hash = keccak256(toBytes(userWallet.toLowerCase()));
    const slice = BigInt('0x' + hash.substring(2, 18));
    const mod = slice % BigInt(2147483647);
    return Number(mod);
  }

  async deployForUser(userWallet: string) {
    if (!isAddress(userWallet)) throw new BadRequestException('Invalid EVM address');

    const chainId = this.generateChainId(userWallet);

    try {
      const result = await this.orbit.deployL3({ userWallet, chainId });

      await this.repo.append({
        userWallet,
        chainId,
        txHash: result.txHash,
        coreContracts: result.coreContracts,
        createdAt: new Date().toISOString(),
      });

      return {
        l3ChainId: String(chainId),
        coreContracts: result.coreContracts,
        txHash: result.txHash,
      };
    } catch (e: any) {
      const msg = e?.message || 'Deployment failed';
      throw new InternalServerErrorException(msg);
    }
  }

  async getStatus(userWallet: string) {
    if (!isAddress(userWallet)) throw new BadRequestException('Invalid EVM address');
    const { user, deployment } = await this.repo.findLatestByWallet(userWallet);

    if (!user) {
      return {
        message: 'User not found',
        l3Exists: false,
        additionalInfo: { chainId: '' },
      };
    }

    if (!deployment) {
      return {
        message: 'No deployment found for this user',
        l3Exists: false,
        additionalInfo: { chainId: '' },
      };
    }

    return {
      message: 'Deployment found',
      l3Exists: true,
      additionalInfo: { chainId: String(deployment.chainId) },
    };
  }

  private generateSecretKey() {
    const key = crypto.randomBytes(32); // 256-bit
    return { key, keyB64: key.toString('base64') };
  }

  private encryptPayload(key: Buffer, payload: any) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      algo: 'AES-256-GCM',
      ivB64: iv.toString('base64'),
      tagB64: tag.toString('base64'),
      ciphertextB64: encrypted.toString('base64'),
    };
  }

  async encryptForUser(userWallet: string, dto: EncryptPayloadDto) {
    if (!isAddress(userWallet)) throw new BadRequestException('Invalid EVM address');
    if (!dto?.items?.length) throw new BadRequestException('items are required');

    const user = await this.repo.upsertUser(userWallet);
    const secret = await this.repo.getOrCreateSecret(user._id, () => this.generateSecretKey());
    const key = Buffer.from(secret.key, 'base64');

    const enc = this.encryptPayload(key, dto.items);
    await this.repo.saveEncryptedMessage(user._id, enc);
    await this.repo.createTransaction(user._id, dto.items.map(i => ({ recipient: i.recipient, amount: i.amount })));

    const l3ChainId = String(this.generateChainId(userWallet));
    const encryptedMessage = `${enc.ivB64}:${enc.tagB64}:${enc.ciphertextB64}`;

    return {
      message: 'Encrypted successfully',
      l3ChainId,
      encryptedMessage,
    };
  }
}
