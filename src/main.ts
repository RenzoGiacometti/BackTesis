import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ─── Global prefix ─────────────────────────────────────────────────────────
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'uploads/(.*)', method: RequestMethod.GET }],
  });

  // ─── CORS ──────────────────────────────────────────────────────────────────
  const allowedOrigins = [
    process.env.CORS_ORIGIN ?? 'http://localhost:8080',
    'http://localhost:8080',
    'http://localhost:5173',
    'http://localhost:3001', // Swagger UI
  ];
  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (ej: Swagger, curl, Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} no permitido`));
      }
    },
    credentials: true,
  });

  // ─── Global validation ─────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // Strip unknown properties
      forbidNonWhitelisted: true,
      transform: true,       // Auto-transform payloads to DTO instances
    }),
  );

  // ─── Swagger ───────────────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('PluvIA API')
    .setDescription('Backend REST API para la plataforma PluvIA')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // ─── Static files (mock images) ─────────────────────────────────────────────
  app.useStaticAssets(join(process.cwd(), 'public'), { prefix: '/public' });

  // ─── Listen ────────────────────────────────────────────────────────────────
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 PluvIA API running on: http://localhost:${port}/api`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
