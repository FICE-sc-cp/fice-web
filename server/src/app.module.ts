import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { BotModule } from './bot/bot.module';
import { EventModule } from './event/event.module';
import { PartnerModule } from './partner/partner.module';
import { EventDetailsModule } from './event-details/event-details.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BotModule,
    EventModule,
    PartnerModule,
    EventDetailsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
