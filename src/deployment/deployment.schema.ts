import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../users/user.schema';

@Schema({ timestamps: true })
export class Deployment {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user!: Types.ObjectId;

  @Prop({ type: Number, required: true })
  chainId!: number;

  @Prop({ type: String, required: true })
  txHash!: string;

  @Prop({ type: Object, required: true })
  coreContracts!: Record<string, any>;

  @Prop({ type: Date, default: Date.now })
  createdAt!: Date;
}

export type DeploymentDocument = HydratedDocument<Deployment>;
export const DeploymentSchema = SchemaFactory.createForClass(Deployment);
