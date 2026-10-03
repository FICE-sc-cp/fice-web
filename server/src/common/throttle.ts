import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import type { Request } from 'express';

export const TRUST_PROXY = 'loopback, linklocal, uniquelocal';

export const THROTTLE_TTL = 60_000;
export const READ_LIMIT_PER_IP = 2000;
export const WRITE_LIMIT_PER_IP = 300;

export const REGISTER_LIMIT_PER_IP = 60;
export const APPLICANT_LIMIT_PER_IP = 30;
export const PARTNER_LIMIT_PER_IP = 10;
export const PUBLIC_UPLOAD_LIMIT_PER_IP = 30;

const READ_METHODS = new Set(['GET', 'HEAD']);

type TrustFn = (addr: string, hop: number) => boolean;

function requestOf(context: ExecutionContext): Request {
  return context.switchToHttp().getRequest<Request>();
}

export function isReadRequest(req: Pick<Request, 'method'>): boolean {
  return READ_METHODS.has(req.method);
}

export function isInternalRead(req: Request): boolean {
  if (!isReadRequest(req)) return false;
  if (req.headers['x-forwarded-for'] !== undefined) return false;
  const peer = req.socket?.remoteAddress;
  const isTrusted = req.app?.get('trust proxy fn') as TrustFn | undefined;
  return !!peer && typeof isTrusted === 'function' && isTrusted(peer, 0);
}

export function throttlerOptions(): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        name: 'default',
        ttl: THROTTLE_TTL,
        limit: (context) =>
          isReadRequest(requestOf(context))
            ? READ_LIMIT_PER_IP
            : WRITE_LIMIT_PER_IP,
      },
    ],
    skipIf: (context) => isInternalRead(requestOf(context)),
  };
}
