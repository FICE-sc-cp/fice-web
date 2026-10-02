import { randomUUID } from 'crypto';
import { closeSync, openSync, readSync, unlinkSync } from 'fs';
import { extname } from 'path';
import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { diskStorage } from 'multer';
import { Admin } from '../auth/admin.decorator';
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_DIR,
  UPLOAD_URL_PREFIX,
} from './upload.constants';

const ALLOWED_MIME_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
};

function getSafeExtension(
  mimetype: string,
  originalname: string,
): string | null {
  const mime = mimetype.toLowerCase();
  const allowedExts = ALLOWED_MIME_EXTENSIONS[mime];
  if (!allowedExts) return null;

  const rawExt = extname(originalname).toLowerCase();
  if (allowedExts.includes(rawExt)) {
    return rawExt;
  }
  return allowedExts[0];
}

function validateMagicBytes(filePath: string, ext: string): boolean {
  try {
    const fd = openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    const bytesRead = readSync(fd, buf, 0, 16, 0);
    closeSync(fd);
    if (bytesRead < 4) return false;

    if (ext === '.jpg' || ext === '.jpeg') {
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    }
    if (ext === '.png') {
      return (
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a
      );
    }
    if (ext === '.webp') {
      return (
        buf.toString('ascii', 0, 4) === 'RIFF' &&
        buf.toString('ascii', 8, 12) === 'WEBP'
      );
    }
    if (ext === '.pdf') {
      return buf.toString('ascii', 0, 4) === '%PDF';
    }
    return false;
  } catch {
    return false;
  }
}

const imageOrPdfUpload = FileInterceptor('file', {
  storage: diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const safeExt =
        getSafeExtension(file.mimetype, file.originalname) ?? '.bin';
      cb(null, `${randomUUID()}${safeExt}`);
    },
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const safeExt = getSafeExtension(file.mimetype, file.originalname);
    if (!safeExt) {
      cb(
        new BadRequestException(
          'Дозволені тільки безпечні зображення (JPEG, PNG, WEBP) або PDF-файли. SVG та виконувані файли заборонені.',
        ),
        false,
      );
      return;
    }
    cb(null, true);
  },
});

function toResult(file?: Express.Multer.File) {
  if (!file) {
    throw new BadRequestException('No file uploaded (field name: "file")');
  }
  const ext = extname(file.filename).toLowerCase();
  if (!validateMagicBytes(file.path, ext)) {
    try {
      unlinkSync(file.path);
    } catch {}
    throw new BadRequestException(
      'Вміст файлу не відповідає дозволеному формату або файл пошкоджено (перевірка сигнатури не пройдена)',
    );
  }
  return {
    filename: file.filename,
    url: `${UPLOAD_URL_PREFIX}/${file.filename}`,
  };
}

const fileBody = {
  schema: {
    type: 'object',
    properties: { file: { type: 'string', format: 'binary' } },
  },
};

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  @Post()
  @Admin()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an image and get its URL (admin)' })
  @ApiBody(fileBody)
  @UseInterceptors(imageOrPdfUpload)
  upload(@UploadedFile() file?: Express.Multer.File) {
    return toResult(file);
  }

  @Post('public')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload an image publicly (e.g. a payment receipt)',
  })
  @ApiBody(fileBody)
  @UseInterceptors(imageOrPdfUpload)
  uploadPublic(@UploadedFile() file?: Express.Multer.File) {
    return toResult(file);
  }
}
