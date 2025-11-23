import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ListenerService } from './listener.service';

@Module({
  imports: [ConfigModule],
  providers: [ListenerService],
})
export class ListenerModule {}
