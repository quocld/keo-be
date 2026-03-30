import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { BetterStackLogger } from '../logging/better-stack.logger';
import { expoPushWorkerLog } from './worker/expo-push-job.types';
import { ExpoPushWorkerModule } from './worker/expo-push-worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(ExpoPushWorkerModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(BetterStackLogger));
  app.enableShutdownHooks();
  Logger.log(expoPushWorkerLog('started'));
}

void bootstrap();
