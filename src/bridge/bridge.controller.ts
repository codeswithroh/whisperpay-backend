import { Body, Controller, Post, BadRequestException } from '@nestjs/common';
import { BridgeService } from './bridge.service';
import { BridgeRequestDto } from './bridge.dto';

@Controller('bridge-to-l3')
export class BridgeController {
  constructor(private readonly service: BridgeService) {}

  @Post()
  async bridge(@Body() dto: BridgeRequestDto) {
    if (!dto?.token || !dto?.amount || !dto?.to) throw new BadRequestException('token, amount, to are required');
    return this.service.bridgeToL3(dto);
  }
}
