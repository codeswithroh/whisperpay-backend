import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../users/user.schema';

@Schema({ timestamps: true })
export class UserSecret {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, unique: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: String, required: true })
  key!: string; // base64
}

export type UserSecretDocument = HydratedDocument<UserSecret>;
export const UserSecretSchema = SchemaFactory.createForClass(UserSecret);
