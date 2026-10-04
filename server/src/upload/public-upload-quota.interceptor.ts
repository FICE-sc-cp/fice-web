import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { from, switchMap } from 'rxjs';
import { hashIp, PublicUploadService } from './public-upload.service';
import { MAX_UPLOAD_BYTES } from './upload.constants';

export function clientIpHash(req: Request): string {
  return hashIp(req.ip ?? req.socket?.remoteAddress ?? 'unknown');
}

@Injectable()
export class PublicUploadQuotaInterceptor implements NestInterceptor {
  constructor(private readonly uploads: PublicUploadService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<Request>();
    const declared = Number(req.headers['content-length']) || 0;
    return from(
      this.uploads.assertQuota(
        clientIpHash(req),
        Math.min(declared, MAX_UPLOAD_BYTES),
      ),
    ).pipe(switchMap(() => next.handle()));
  }
}
