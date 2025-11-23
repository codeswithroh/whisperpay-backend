import { Module } from '@nestjs/common';
import { DeploymentController } from './deployment.controller';
import { DeploymentService } from './deployment.service';
import { OrbitModule } from '../orbit/orbit.module';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/user.schema';
import { Deployment, DeploymentSchema } from './deployment.schema';
import { DeploymentRepository } from './deployment.repository';
import { UserSecret, UserSecretSchema } from '../security/user-secret.schema';
import { EncryptedMessage, EncryptedMessageSchema } from '../security/encrypted-message.schema';
import { Transaction, TransactionSchema } from '../transactions/transaction.schema';

@Module({
  imports: [
    OrbitModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Deployment.name, schema: DeploymentSchema },
      { name: UserSecret.name, schema: UserSecretSchema },
      { name: EncryptedMessage.name, schema: EncryptedMessageSchema },
      { name: Transaction.name, schema: TransactionSchema },
    ]),
  ],
  controllers: [DeploymentController],
  providers: [DeploymentService, DeploymentRepository],
})
export class DeploymentModule {}
