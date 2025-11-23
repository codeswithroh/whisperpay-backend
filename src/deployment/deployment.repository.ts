import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/user.schema';
import { Deployment } from './deployment.schema';
import { UserSecret } from '../security/user-secret.schema';
import { EncryptedMessage } from '../security/encrypted-message.schema';

export interface DeploymentRecord {
  userWallet: string;
  chainId: number;
  txHash: string;
  coreContracts: Record<string, any>;
  createdAt: string;
}

@Injectable()
export class DeploymentRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Deployment.name) private readonly deploymentModel: Model<Deployment>,
    @InjectModel(UserSecret.name) private readonly userSecretModel: Model<UserSecret>,
    @InjectModel(EncryptedMessage.name) private readonly encMsgModel: Model<EncryptedMessage>,
  ) {}

  async append(record: DeploymentRecord) {
    const wallet = record.userWallet.toLowerCase();
    const user = await this.userModel
      .findOneAndUpdate(
        { wallet },
        { $setOnInsert: { wallet } },
        { upsert: true, new: true },
      )
      .lean(false);

    await this.deploymentModel.create({
      user: (user as any)._id,
      chainId: record.chainId,
      txHash: record.txHash,
      coreContracts: record.coreContracts,
      createdAt: new Date(record.createdAt),
    });
  }

  async getLatest() {
    return this.deploymentModel.findOne().sort({ createdAt: -1 }).lean();
  }

  async findUserByWallet(wallet: string) {
    return this.userModel.findOne({ wallet: wallet.toLowerCase() }).lean();
  }

  async findLatestByUserId(userId: any) {
    return this.deploymentModel.findOne({ user: userId }).sort({ createdAt: -1 }).lean();
  }

  async findLatestByWallet(wallet: string) {
    const user = await this.findUserByWallet(wallet);
    if (!user) return { user: null, deployment: null } as { user: any; deployment: any };
    const deployment = await this.findLatestByUserId((user as any)._id);
    return { user, deployment } as { user: any; deployment: any };
  }

  async upsertUser(wallet: string) {
    const w = wallet.toLowerCase();
    const user = await this.userModel
      .findOneAndUpdate({ wallet: w }, { $setOnInsert: { wallet: w } }, { upsert: true, new: true })
      .lean(false);
    return user as any;
  }

  async getOrCreateSecret(userId: any, generateKey: () => { keyB64: string }) {
    let secret = await this.userSecretModel.findOne({ user: userId }).lean(false);
    if (!secret) {
      const { keyB64 } = generateKey();
      secret = await this.userSecretModel.create({ user: userId, key: keyB64 });
    }
    return secret as any;
  }

  async saveEncryptedMessage(userId: any, data: { algo: string; ivB64: string; tagB64: string; ciphertextB64: string }) {
    await this.encMsgModel.create({
      user: userId,
      algo: data.algo,
      iv: data.ivB64,
      tag: data.tagB64,
      ciphertext: data.ciphertextB64,
    });
  }
}
