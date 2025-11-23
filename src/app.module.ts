import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { DeploymentModule } from './deployment/deployment.module';
import { OrbitModule } from './orbit/orbit.module';
import { BridgeModule } from './bridge/bridge.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ListenerModule } from './listener/listener.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/whisperpay'),
    ThrottlerModule.forRoot([{ ttl: 60, limit: 10 }]),
    OrbitModule,
    DeploymentModule,
    BridgeModule,
    ListenerModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
