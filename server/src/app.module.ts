import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BotModule } from './bot/bot.module';
import { UploadModule } from './upload/upload.module';
import { EventModule } from './modules/event/event.module';
import { EventDetailsModule } from './modules/event-details/event-details.module';
import { PartnerModule } from './modules/partner/partner.module';
import { FundraiserModule } from './modules/fundraiser/fundraiser.module';
import { UserModule } from './modules/user/user.module';
import { DepartmentModule } from './modules/department/department.module';
import { DepartmentMemberModule } from './modules/department_member/department_member.module';
import { DepartmentDetailsModule } from './modules/department_details/department_details.module';
import { DepartmentHeadModule } from './modules/department_head/department_head.module';
import { NewsModule } from './modules/news/news.module';
import { ApplicantModule } from './modules/applicant/applicant.module';
import { FactsModule } from './modules/facts/facts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    BotModule,
    UploadModule,
    EventModule,
    EventDetailsModule,
    PartnerModule,
    FundraiserModule,
    UserModule,
    DepartmentModule,
    DepartmentMemberModule,
    DepartmentDetailsModule,
    DepartmentHeadModule,
    NewsModule,
    ApplicantModule,
    FactsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
