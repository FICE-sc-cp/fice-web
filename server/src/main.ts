import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Fice API')
    .setDescription('Fice API documentation')
    .setVersion('1.0')
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

  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
