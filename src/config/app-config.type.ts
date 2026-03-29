export type AppConfig = {
  nodeEnv: string;
  name: string;
  workingDirectory: string;
  frontendDomain?: string;
  backendDomain: string;
  port: number;
  apiPrefix: string;
  fallbackLanguage: string;
  headerLanguage: string;
  /** When false, do not send logs to Better Stack even if a source token is set. */
  betterStackEnabled: boolean;
  betterStackSourceToken?: string;
  betterStackEndpoint?: string;
  /** When false, skip HTTP access logging. */
  httpLogEnabled: boolean;
  /** Paths to skip for access logs (exact or prefix). */
  httpLogSkipPaths: string[];
  /** Include exception stack traces in logs when NODE_ENV is production. */
  logStackInProduction: boolean;
};
