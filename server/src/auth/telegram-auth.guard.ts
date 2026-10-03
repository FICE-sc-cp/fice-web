import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AdminAccessService } from './admin-access.service';

@Injectable()
export class TelegramAuthGuard implements CanActivate {
  constructor(private readonly adminAccess: AdminAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const initData = request.headers['x-telegram-init-data'];
    await this.adminAccess.assertAdmin(
      typeof initData === 'string' ? initData : undefined,
    );
    return true;
  }
}
