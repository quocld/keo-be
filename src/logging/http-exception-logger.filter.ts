import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AllConfigType } from '../config/config.type';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';

@Catch()
export class HttpExceptionLoggerFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionLoggerFilter.name);

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const { httpAdapter } = this.httpAdapterHost;

    const requestId = request.requestId;
    const userId = (request.user as JwtPayloadType | undefined)?.id;

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const nodeEnv = this.configService.get('app.nodeEnv', { infer: true });
    const logStackInProduction = this.configService.get(
      'app.logStackInProduction',
      { infer: true },
    );
    const includeStack =
      nodeEnv !== 'production' || logStackInProduction === true;

    const err = exception instanceof Error ? exception : null;
    const message =
      exception instanceof HttpException
        ? exception.message
        : (err?.message ?? 'Internal server error');

    const path = request.url?.split('?')[0];

    this.logger.error('http_exception', {
      requestId,
      userId,
      path,
      method: request.method,
      statusCode: httpStatus,
      name:
        err?.name ??
        (exception instanceof HttpException ? 'HttpException' : 'Error'),
      message,
      ...(includeStack && err?.stack ? { stack: err.stack } : {}),
    });

    const responseBody =
      exception instanceof HttpException
        ? exception.getResponse()
        : {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Internal server error',
          };

    const body =
      typeof responseBody === 'string'
        ? { statusCode: httpStatus, message: responseBody }
        : responseBody;

    httpAdapter.reply(ctx.getResponse(), body, httpStatus);
  }
}
