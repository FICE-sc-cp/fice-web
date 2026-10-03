import { mkdirSync } from 'fs';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { UPLOAD_DIR, UPLOAD_URL_PREFIX } from './upload/upload.constants';
import { setUploadHeaders } from './upload/upload-headers';
import { TRUST_PROXY } from './common/throttle';

// Polyfill BigInt JSON serialization globally
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.set('trust proxy', TRUST_PROXY);

  app.use((_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : true;
  app.enableCors({ origin: allowedOrigins, credentials: true });

  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new PrismaExceptionFilter());

  const uploadPath = resolve(UPLOAD_DIR);
  mkdirSync(uploadPath, { recursive: true });
  app.useStaticAssets(uploadPath, {
    prefix: `${UPLOAD_URL_PREFIX}/`,
    setHeaders: setUploadHeaders,
  });

  const config = new DocumentBuilder()
    .setTitle('Fice API')
    .setDescription(
      'Student council website API — public content for the site and ' +
        'Telegram-authenticated endpoints for the admin panel.',
    )
    .setVersion('1.0')
    .addApiKey(
      { type: 'apiKey', name: 'x-telegram-init-data', in: 'header' },
      'telegram',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);

  app.use(
    '/api/docs',
    apiReference({
      content: document,
      theme: 'alternate',
      defaultHttpClient: {
        targetKey: 'js',
        clientKey: 'axios',
      },
    }),
  );

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}

void bootstrap();
