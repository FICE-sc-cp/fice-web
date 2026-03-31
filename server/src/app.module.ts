import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { BotModule } from './bot/bot.module';
import { EventModule } from './modules/event/event.module';
import { PartnerModule } from './modules/partner/partner.module';
import { EventDetailsModule } from './modules/event-details/event-details.module';
import { FundraiserModule } from './modules/fundraiser/fundraiser.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BotModule,
    EventModule,
    PartnerModule,
    EventDetailsModule,
    FundraiserModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
