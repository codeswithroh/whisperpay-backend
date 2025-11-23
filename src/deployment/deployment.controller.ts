import { Body, Controller, Post, BadRequestException, Get, Query } from '@nestjs/common';
import { DeployL3Dto } from './dto/deploy-l3.dto';
import { DeploymentService } from './deployment.service';
import { EncryptPayloadDto } from './dto/encrypt.dto';

@Controller('deploy-l3')
export class DeploymentController {
  constructor(private readonly service: DeploymentService) {}

  @Post()
  async deploy(@Body() dto: DeployL3Dto) {
    if (!dto.userWallet) throw new BadRequestException('userWallet is required');
    return this.service.deployForUser(dto.userWallet);
  }

  @Get('status')
  async status(@Query('wallet') wallet?: string) {
    if (!wallet) throw new BadRequestException('wallet is required');
    return this.service.getStatus(wallet);
  }

  @Post('encrypt')
  async encrypt(@Query('wallet') wallet?: string, @Body() dto?: EncryptPayloadDto) {
    if (!wallet) throw new BadRequestException('wallet is required');
    return this.service.encryptForUser(wallet, dto as EncryptPayloadDto);
  }
}
