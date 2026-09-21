import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { BlockedUsersController } from './blocked-users.controller';
import { BlockedUsersService } from './blocked-users.service';

@Module({
  imports: [PrismaModule],
  controllers: [BlockedUsersController],
  providers: [BlockedUsersService],
  exports: [BlockedUsersService],
})
export class BlockedUsersModule {}
