import { Controller, Get, INestApplication, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import {
  READ_LIMIT_PER_IP,
  throttlerOptions,
  TRUST_PROXY,
  WRITE_LIMIT_PER_IP,
} from './throttle';

const TTL = 400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Controller()
class TestController {
  @Post('a')
  @Throttle({ default: { limit: 2, ttl: TTL } })
  a() {
    return 'a';
  }

  @Post('b')
  @Throttle({ default: { limit: 2, ttl: TTL } })
  b() {
    return 'b';
  }

  @Get('read')
  @Throttle({ default: { limit: 1, ttl: 60_000 } })
  read() {
    return 'read';
  }

  @Get('default-read')
  defaultRead() {
    return 'ok';
  }

  @Post('default-write')
  defaultWrite() {
    return 'ok';
  }
}

describe('throttling', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(throttlerOptions())],
      controllers: [TestController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();
    const nest = moduleRef.createNestApplication<NestExpressApplication>();
    nest.set('trust proxy', TRUST_PROXY);
    await nest.init();
    app = nest;
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (path: string, ip: string) =>
    request(app.getHttpServer()).post(path).set('X-Forwarded-For', ip);

  it('keys limits per client IP and per route', async () => {
    await post('/a', '203.0.113.1').expect(201);
    await post('/a', '203.0.113.1').expect(201);
    await post('/a', '203.0.113.1').expect(429);

    await post('/b', '203.0.113.1').expect(201);
    await post('/a', '203.0.113.2').expect(201);
  });

  it("does not freeze one route's counter when another route's block expires", async () => {
    const ip = '198.51.100.7';
    await post('/a', ip).expect(201);
    await post('/a', ip).expect(201);
    await post('/a', ip).expect(429);

    await sleep(TTL * 0.6);
    await post('/b', ip).expect(201);
    await post('/b', ip).expect(201);

    await sleep(TTL * 0.5);
    await post('/a', ip).expect(201);

    await sleep(TTL * 0.8);
    await post('/b', ip).expect(201);
    await post('/b', ip).expect(201);
  });

  it('never throttles internal reads without X-Forwarded-For', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer()).get('/read').expect(200);
    }
  });

  it('throttles proxied reads from a client IP', async () => {
    const get = () =>
      request(app.getHttpServer())
        .get('/read')
        .set('X-Forwarded-For', '192.0.2.10');
    await get().expect(200);
    await get().expect(429);
  });

  it('ignores a spoofed X-Forwarded-For hop in front of the real client', async () => {
    const get = (spoofed: string) =>
      request(app.getHttpServer())
        .get('/read')
        .set('X-Forwarded-For', `${spoofed}, 192.0.2.20`);
    await get('1.1.1.1').expect(200);
    await get('8.8.8.8').expect(429);
  });

  it('applies the default read and write limits', async () => {
    const read = await request(app.getHttpServer())
      .get('/default-read')
      .set('X-Forwarded-For', '192.0.2.30')
      .expect(200);
    expect(read.headers['x-ratelimit-limit']).toBe(String(READ_LIMIT_PER_IP));

    const write = await post('/default-write', '192.0.2.30').expect(201);
    expect(write.headers['x-ratelimit-limit']).toBe(String(WRITE_LIMIT_PER_IP));
  });
});
