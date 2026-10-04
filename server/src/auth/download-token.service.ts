import { randomBytes } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';

export const DOWNLOAD_TOKEN_TTL_MS = 2 * 60_000;

interface Grant {
  resource: string;
  expiresAt: number;
}

@Injectable()
export class DownloadTokenService {
  private readonly grants = new Map<string, Grant>();

  issue(resource: string, now = Date.now()): string {
    this.prune(now);
    const token = randomBytes(24).toString('base64url');
    this.grants.set(token, {
      resource,
      expiresAt: now + DOWNLOAD_TOKEN_TTL_MS,
    });
    return token;
  }

  redeem(token: string | undefined, resource: string, now = Date.now()) {
    const grant = token ? this.grants.get(token) : undefined;
    if (token) this.grants.delete(token);
    if (!grant || grant.resource !== resource || grant.expiresAt <= now) {
      throw new UnauthorizedException(
        'Посилання на файл недійсне або застаріло. Спробуйте завантажити ще раз.',
      );
    }
  }

  private prune(now: number) {
    for (const [token, grant] of this.grants) {
      if (grant.expiresAt <= now) this.grants.delete(token);
    }
  }
}
