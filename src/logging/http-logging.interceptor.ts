import {
  Injectable,
  Logger,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { AllConfigType } from '../config/config.type';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';

function pathMatchesSkip(path: string, skipPaths: string[]): boolean {
  return skipPaths.some((p) => path === p || path.startsWith(`${p}/`));
}

function clientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }
  return req.ip || req.socket?.remoteAddress;
}

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpLogEnabled = this.configService.get('app.httpLogEnabled', {
      infer: true,
    });
    if (!httpLogEnabled) {
      return next.handle();
    }

    const skipPaths = this.configService.get('app.httpLogSkipPaths', {
      infer: true,
    }) as string[];

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const path = req.path || req.url?.split('?')[0] || '';
    if (pathMatchesSkip(path, skipPaths)) {
      return next.handle();
    }

    const start = Date.now();
    let finished = false;

    const onFinish = () => {
      if (finished) {
        return;
      }
      finished = true;
      const durationMs = Date.now() - start;
      const user = req.user as JwtPayloadType | undefined;
      const payload: Record<string, unknown> = {
        type: 'http_access',
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs,
        requestId: req.requestId,
      };
      const ip = clientIp(req);
      if (ip) {
        payload.clientIp = ip;
      }
      if (user?.id != null) {
        payload.userId = user.id;
      }
      this.logger.log('http_access', payload);
    };

    res.on('finish', onFinish);
    res.on('close', onFinish);

    return next.handle();
  }
}
