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
import { DepartmentModule } from './modules/department/department.module';
import { DepartmentMemberModule } from './modules/department_member/department_member.module';
import { DepartmentDetailsModule } from './modules/department_details/department_details.module';
import { DepartmentHeadModule } from './modules/department_head/department_head.module';

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
    DepartmentModule,
    DepartmentMemberModule,
    DepartmentDetailsModule,
    DepartmentHeadModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
