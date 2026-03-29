import { registerAs } from '@nestjs/config';
import { AppConfig } from './app-config.type';
import validateConfig from '.././utils/validate-config';
import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/** Fixed HTTP listen port (not read from env — avoids PORT vs DATABASE_PORT confusion on Railway). */
export const APP_HTTP_PORT = 8080;

class EnvironmentVariablesValidator {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment;

  @IsUrl({ require_tld: false })
  @IsOptional()
  FRONTEND_DOMAIN: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  BACKEND_DOMAIN: string;

  @IsString()
  @IsOptional()
  API_PREFIX: string;

  @IsString()
  @IsOptional()
  APP_FALLBACK_LANGUAGE: string;

  @IsString()
  @IsOptional()
  APP_HEADER_LANGUAGE: string;

  @IsString()
  @IsOptional()
  BETTER_STACK_SOURCE_TOKEN: string;

  @IsString()
  @IsOptional()
  HTTP_LOG_SKIP_PATHS: string;
}

function parseHttpLogSkipPaths(raw: string | undefined): string[] {
  const defaults = ['/docs', '/docs-json'];
  const extra =
    raw
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  return [...new Set([...defaults, ...extra])];
}

export default registerAs<AppConfig>('app', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    name: process.env.APP_NAME || 'app',
    workingDirectory: process.env.PWD || process.cwd(),
    frontendDomain: process.env.FRONTEND_DOMAIN,
    backendDomain: process.env.BACKEND_DOMAIN ?? 'http://localhost',
    port: APP_HTTP_PORT,
    apiPrefix: process.env.API_PREFIX || 'api',
    fallbackLanguage: process.env.APP_FALLBACK_LANGUAGE || 'en',
    headerLanguage: process.env.APP_HEADER_LANGUAGE || 'x-custom-lang',
    betterStackEnabled: process.env.BETTER_STACK_ENABLED !== 'false',
    betterStackSourceToken:
      process.env.BETTER_STACK_SOURCE_TOKEN?.trim() || undefined,
    betterStackEndpoint: process.env.BETTER_STACK_ENDPOINT?.trim() || undefined,
    httpLogEnabled: process.env.HTTP_LOG_ENABLED !== 'false',
    httpLogSkipPaths: parseHttpLogSkipPaths(process.env.HTTP_LOG_SKIP_PATHS),
    logStackInProduction: process.env.LOG_STACK_IN_PRODUCTION === 'true',
  };
});
