import { ArrayNotEmpty, IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PaymentItemDto {
  @IsString()
  recipient!: string;

  @IsString()
  amount!: string;
}

export class EncryptPayloadDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PaymentItemDto)
  items!: PaymentItemDto[];
}
