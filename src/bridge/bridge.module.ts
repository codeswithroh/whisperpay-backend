import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BridgeController } from './bridge.controller';
import { BridgeService } from './bridge.service';
import { DeploymentRepository } from '../deployment/deployment.repository';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/user.schema';
import { Deployment, DeploymentSchema } from '../deployment/deployment.schema';
import { UserSecret, UserSecretSchema } from '../security/user-secret.schema';
import { EncryptedMessage, EncryptedMessageSchema } from '../security/encrypted-message.schema';
import { Transaction, TransactionSchema } from '../transactions/transaction.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Deployment.name, schema: DeploymentSchema },
      { name: UserSecret.name, schema: UserSecretSchema },
      { name: EncryptedMessage.name, schema: EncryptedMessageSchema },
      { name: Transaction.name, schema: TransactionSchema },
    ]),
  ],
  controllers: [BridgeController],
  providers: [BridgeService, DeploymentRepository],
})
export class BridgeModule {}
