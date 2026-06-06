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

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({ origin: true, credentials: true });

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
  app.useStaticAssets(uploadPath, { prefix: `${UPLOAD_URL_PREFIX}/` });

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
