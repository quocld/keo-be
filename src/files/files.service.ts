import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { FileRepository } from './infrastructure/persistence/file.repository';
import { FileType } from './domain/file';
import { NullableType } from '../utils/types/nullable.type';
import { AllConfigType } from '../config/config.type';
import { FileDriver } from './config/file-config.type';

@Injectable()
export class FilesService {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  findById(id: FileType['id']): Promise<NullableType<FileType>> {
    return this.fileRepository.findById(id);
  }

  findByIds(ids: FileType['id'][]): Promise<FileType[]> {
    return this.fileRepository.findByIds(ids);
  }

  /** Resolves stored file path/key to a client-usable URL (aligned with FileType serialization). */
  async resolvePublicUrl(storedPath: string): Promise<string> {
    const fileConf = this.configService.getOrThrow('file', { infer: true });
    const appConf = this.configService.getOrThrow('app', { infer: true });

    if (fileConf.driver === FileDriver.LOCAL) {
      return appConf.backendDomain + storedPath;
    }

    if ([FileDriver.S3_PRESIGNED, FileDriver.S3].includes(fileConf.driver)) {
      const s3 = new S3Client({
        region: fileConf.awsS3Region ?? '',
        credentials: {
          accessKeyId: fileConf.accessKeyId ?? '',
          secretAccessKey: fileConf.secretAccessKey ?? '',
        },
      });

      const command = new GetObjectCommand({
        Bucket: fileConf.awsDefaultS3Bucket ?? '',
        Key: storedPath,
      });

      return getSignedUrl(s3, command, { expiresIn: 3600 });
    }

    return storedPath;
  }

  /**
   * Builds a URL the client can open for a receipt image.
   * - Storage keys (no scheme): same as {@link resolvePublicUrl}.
   * - Absolute URLs pointing at our configured S3 bucket (including expired
   *   presigned URLs): object key is taken from the path and re-signed.
   * - Other absolute URLs (e.g. client-supplied https://…): returned unchanged.
   */
  async resolveReceiptImageUrlForView(stored: string): Promise<string> {
    const trimmed = stored?.trim();
    if (!trimmed) {
      return trimmed;
    }

    if (!/^https?:\/\//i.test(trimmed)) {
      return this.resolvePublicUrl(trimmed);
    }

    const fileConf = this.configService.getOrThrow('file', { infer: true });
    const bucket = fileConf.awsDefaultS3Bucket ?? '';
    const region = fileConf.awsS3Region ?? '';

    if (
      [FileDriver.S3_PRESIGNED, FileDriver.S3].includes(fileConf.driver) &&
      bucket
    ) {
      const key = this.extractOurS3ObjectKeyFromUrl(trimmed, bucket, region);
      if (key) {
        return this.resolvePublicUrl(key);
      }
    }

    return trimmed;
  }

  private extractOurS3ObjectKeyFromUrl(
    urlString: string,
    bucket: string,
    region: string,
  ): string | null {
    try {
      const u = new URL(urlString);
      const host = u.hostname.toLowerCase();
      const path = decodeURIComponent(u.pathname.replace(/^\//, ''));

      const virtualHosted = [
        `${bucket}.s3.${region}.amazonaws.com`,
        `${bucket}.s3-${region}.amazonaws.com`,
        `${bucket}.s3.amazonaws.com`,
      ];

      if (virtualHosted.includes(host) && path) {
        return path;
      }

      // Path-style: s3.region.amazonaws.com/bucket/key
      if (
        /^s3[.-]/i.test(host) &&
        host.endsWith('.amazonaws.com') &&
        path.startsWith(`${bucket}/`)
      ) {
        return path.slice(bucket.length + 1);
      }
    } catch {
      return null;
    }

    return null;
  }
}
