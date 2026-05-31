import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadBucketCommand,
    CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { FileStorage } from './file-storage.interface';

@Injectable()
export class MinioStorageService implements FileStorage, OnModuleInit {
    private readonly client: S3Client;
    private readonly bucket: string;

    constructor(private readonly config: ConfigService) {
        const endpoint = this.config.getOrThrow<string>('MINIO_ENDPOINT');
        const accessKey = this.config.getOrThrow<string>('MINIO_ACCESS_KEY');
        const secretKey = this.config.getOrThrow<string>('MINIO_SECRET_KEY');
        this.bucket = this.config.get<string>('MINIO_BUCKET', 'pluvia');

        this.client = new S3Client({
            endpoint,
            region: 'us-east-1',
            credentials: {
                accessKeyId: accessKey,
                secretAccessKey: secretKey,
            },
            forcePathStyle: true,
        });
    }

    async onModuleInit(): Promise<void> {
        try {
            await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
        } catch (err: any) {
            if (err.$metadata?.httpStatusCode === 404 || err.name === 'NotFound') {
                await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
            } else {
                throw err;
            }
        }
    }

    async upload(file: Express.Multer.File, subdir: string): Promise<string> {
        const ext = extname(file.originalname) || '.bin';
        const filename = `${randomUUID()}${ext}`;
        const key = `${subdir}/${filename}`;

        await this.client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
        }));

        return `/uploads/${key}`;
    }

    async getStream(relativePath: string): Promise<Readable> {
        const key = this.extractKey(relativePath);

        const response = await this.client.send(new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        }));

        if (!response.Body) {
            throw new BadRequestException('Archivo no encontrado en storage');
        }

        return response.Body as Readable;
    }

    async delete(relativePath: string): Promise<void> {
        const key = this.extractKey(relativePath);

        await this.client.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        }));
    }

    private extractKey(relativePath: string): string {
        const decoded = decodeURIComponent(relativePath);
        const key = decoded.replace(/^\/uploads\/?/, '');
        if (!key || key.includes('..') || key.startsWith('/')) {
            throw new BadRequestException('Ruta de archivo invalida');
        }
        return key;
    }
}
