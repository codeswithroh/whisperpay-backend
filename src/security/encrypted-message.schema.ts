import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../users/user.schema';

@Schema({ timestamps: true })
export class EncryptedMessage {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: String, required: true })
  algo!: string; // e.g., AES-256-GCM

  @Prop({ type: String, required: true })
  iv!: string; // base64

  @Prop({ type: String, required: true })
  tag!: string; // base64

  @Prop({ type: String, required: true })
  ciphertext!: string; // base64
}

export type EncryptedMessageDocument = HydratedDocument<EncryptedMessage>;
export const EncryptedMessageSchema = SchemaFactory.createForClass(EncryptedMessage);
