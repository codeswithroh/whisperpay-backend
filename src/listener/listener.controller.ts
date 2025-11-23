import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { isAddress } from 'viem';
import { ListenerService } from './listener.service';

@Controller('listener')
export class ListenerController {
  constructor(private readonly service: ListenerService) {}

  // POST /listener/transfer { jobCreator?: string }
  @Post('transfer')
  async transfer(@Body() body?: { jobCreator?: string }) {
    const provided = body?.jobCreator;
    const fallback = '0x2bEb0e1fD3430E8655624A7FCB4E8820397551f8';
    const jobCreator = (provided || fallback) as `0x${string}`;
    if (!isAddress(jobCreator)) throw new BadRequestException('jobCreator must be a valid address');

    try {
      const res = await this.service.triggerTransfer(jobCreator as any);
      return { status: 'submitted', txHash: res.txHash };
    } catch (e: any) {
      // Return a concise error payload while logs have full details
      throw new BadRequestException(e?.shortMessage || e?.message || 'Contract call failed');
    }
  }
}
