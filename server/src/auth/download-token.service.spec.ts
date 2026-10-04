import { UnauthorizedException } from '@nestjs/common';
import {
  DOWNLOAD_TOKEN_TTL_MS,
  DownloadTokenService,
} from './download-token.service';

describe('DownloadTokenService', () => {
  const tokens = new DownloadTokenService();

  it('lets a link be used once, for its own file only', () => {
    const token = tokens.issue('registrations:e1');

    expect(() => tokens.redeem(token, 'registrations:e2')).toThrow(
      UnauthorizedException,
    );

    const again = tokens.issue('registrations:e1');
    expect(() => tokens.redeem(again, 'registrations:e1')).not.toThrow();
    expect(() => tokens.redeem(again, 'registrations:e1')).toThrow(
      UnauthorizedException,
    );
  });

  it('expires links after two minutes', () => {
    const now = 1_000_000;
    const token = tokens.issue('voting:v1', now);

    expect(() =>
      tokens.redeem(token, 'voting:v1', now + DOWNLOAD_TOKEN_TTL_MS),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a missing token', () => {
    expect(() => tokens.redeem(undefined, 'voting:v1')).toThrow(
      UnauthorizedException,
    );
  });
});
