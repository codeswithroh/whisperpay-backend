import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrbitService } from './orbit.service';

@Module({
  imports: [ConfigModule],
  providers: [OrbitService],
  exports: [OrbitService],
})
export class OrbitModule {}
