import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TransactionDocument = HydratedDocument<Transaction>;

export class TransactionItem {
  @Prop({ required: true })
  recipient!: string;

  @Prop({ required: true })
  amount!: string; // decimal string
}

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true, required: true })
  user!: Types.ObjectId;

  @Prop({ type: [{ recipient: String, amount: String }], required: true })
  items!: TransactionItem[];

  @Prop({ type: String, enum: ['pending', 'completed'], default: 'pending', index: true })
  status!: 'pending' | 'completed';
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
