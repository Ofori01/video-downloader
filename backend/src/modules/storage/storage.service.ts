import { Upload } from '@aws-sdk/lib-storage';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client;

  constructor(private readonly config: AppConfigService) {
    this.s3Client = new S3Client({
      endpoint: this.config.r2Endpoint,
      region: this.config.r2Region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.r2AccessKeyId,
        secretAccessKey: this.config.r2SecretAccessKey,
      },
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 15_000,
        requestTimeout: 300_000, // 5 minutes
      }),
    });
  }

  async uploadStream(key: string, body: NodeJS.ReadableStream): Promise<void> {
    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: this.config.r2Bucket,
        Key: key,
        Body: body as Readable,
        ContentType: 'video/mp4',
      },
    });

    await upload.done();
  }

  async uploadBuffer(key: string, body: Buffer): Promise<void> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.config.r2Bucket,
        Key: key,
        Body: body,
        ContentType: 'video/mp4',
      }),
    );
  }

  async getSignedDownloadUrl(key: string): Promise<string> {
    const filename = key.split('/').pop() || 'download.mp4';
    return getSignedUrl(
      this.s3Client,
      new GetObjectCommand({
        Bucket: this.config.r2Bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${filename}"`,
      }),
      {
        expiresIn: this.config.signedUrlTtlSeconds,
      },
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.config.r2Bucket,
        Key: key,
      }),
    );
  }
}
