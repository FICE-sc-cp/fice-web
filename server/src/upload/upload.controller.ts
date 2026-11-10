import { randomUUID } from 'crypto';
import { unlinkSync } from 'fs';
import { extname } from 'path';
import {
  BadRequestException,
  Controller,
  PayloadTooLargeException,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PUBLIC_UPLOAD_LIMIT_PER_IP, THROTTLE_TTL } from '../common/throttle';
import type { Request } from 'express';
import { diskStorage } from 'multer';
import { Admin } from '../auth/admin.decorator';
import {
  MAX_MEDIA_UPLOAD_BYTES,
  MAX_UPLOAD_BYTES,
  UPLOAD_DIR,
  UPLOAD_URL_PREFIX,
} from './upload.constants';
import {
  clientIpHash,
  PublicUploadQuotaInterceptor,
} from './public-upload-quota.interceptor';
import { PublicUploadService } from './public-upload.service';
import {
  ADMIN_IMAGE_PROFILE,
  ImageProfile,
  isProcessableImage,
  PUBLIC_IMAGE_PROFILE,
  reencodeImage,
} from './image-processing';
import { matchesSignature } from './file-signature';
import {
  KIND_MAX_BYTES,
  kindOf,
  MAX_PUBLIC_UPLOAD_BYTES,
  PUBLIC_MIME_EXTENSIONS,
  tooLargeMessage,
} from './upload-types';

const ALLOWED_MIME_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
};

// Admins may also upload animations and short videos (news covers).
const MEDIA_MIME_EXTENSIONS: Record<string, string[]> = {
  'image/gif': ['.gif'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
};
const MEDIA_EXTENSIONS = Object.values(MEDIA_MIME_EXTENSIONS).flat();

export function getSafeExtension(
  mimetype: string,
  originalname: string,
  allowed: Record<string, string[]> = ALLOWED_MIME_EXTENSIONS,
): string | null {
  const rawExt = extname(originalname).toLowerCase();
  const allowedExts = allowed[mimetype.toLowerCase()];
  if (!allowedExts) {
    return Object.values(allowed).flat().includes(rawExt) ? rawExt : null;
  }
  if (allowedExts.includes(rawExt)) {
    return rawExt;
  }
  return allowedExts[0];
}

function removeQuietly(path: string) {
  try {
    unlinkSync(path);
  } catch {
    return;
  }
}

export function uploadInterceptor(
  allowed: Record<string, string[]>,
  maxBytes: number,
  rejection: string,
) {
  return FileInterceptor('file', {
    storage: diskStorage({
      destination: UPLOAD_DIR,
      filename: (_req, file, cb) => {
        const safeExt =
          getSafeExtension(file.mimetype, file.originalname, allowed) ?? '.bin';
        cb(null, `${randomUUID()}${safeExt}`);
      },
    }),
    limits: { fileSize: maxBytes, files: 1, fields: 2, parts: 3 },
    fileFilter: (_req, file, cb) => {
      if (!getSafeExtension(file.mimetype, file.originalname, allowed)) {
        cb(new BadRequestException(rejection), false);
        return;
      }
      cb(null, true);
    },
  });
}

const publicUpload = uploadInterceptor(
  PUBLIC_MIME_EXTENSIONS,
  MAX_PUBLIC_UPLOAD_BYTES,
  'Дозволені фото (JPG, PNG, WEBP), відео (MP4, MOV, WEBM), PDF або документи Word (DOC, DOCX). SVG, HTML та виконувані файли заборонені.',
);

const adminUpload = uploadInterceptor(
  { ...ALLOWED_MIME_EXTENSIONS, ...MEDIA_MIME_EXTENSIONS },
  MAX_MEDIA_UPLOAD_BYTES,
  'Дозволені зображення (JPEG, PNG, WEBP, GIF), відео (MP4, WEBM) або PDF.',
);

export function toResult(file?: Express.Multer.File) {
  if (!file) {
    throw new BadRequestException('No file uploaded (field name: "file")');
  }
  const ext = extname(file.filename).toLowerCase();
  if (!matchesSignature(file.path, ext)) {
    removeQuietly(file.path);
    throw new BadRequestException(
      'Вміст файлу не відповідає дозволеному формату або файл пошкоджено (перевірка сигнатури не пройдена)',
    );
  }
  return {
    filename: file.filename,
    url: `${UPLOAD_URL_PREFIX}/${file.filename}`,
  };
}

async function processUpload(
  profile: ImageProfile,
  file?: Express.Multer.File,
): Promise<{ filename: string; url: string; size: number }> {
  const result = toResult(file);
  const uploaded = file!;
  const ext = extname(uploaded.filename).toLowerCase();
  if (!isProcessableImage(ext)) return { ...result, size: uploaded.size };
  try {
    const size = await reencodeImage(uploaded.path, ext, profile);
    return { ...result, size };
  } catch {
    try {
      unlinkSync(uploaded.path);
    } catch {
      // Best effort: the upload is refused either way.
    }
    throw new BadRequestException(
      'Не вдалося обробити зображення. Спробуйте інший файл.',
    );
  }
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
  constructor(private readonly publicUploads: PublicUploadService) {}

  @Post()
  @Admin()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload an image, GIF or video and get its URL (admin)',
  })
  @ApiBody(fileBody)
  @UseInterceptors(adminUpload)
  async upload(@UploadedFile() file?: Express.Multer.File) {
    // Videos and GIFs may be up to 50 MB; everything else keeps the 5 MB cap.
    if (
      file &&
      file.size > MAX_UPLOAD_BYTES &&
      !MEDIA_EXTENSIONS.includes(extname(file.filename).toLowerCase())
    ) {
      try {
        unlinkSync(file.path);
      } catch {
        // already gone
      }
      throw new PayloadTooLargeException(
        `Файл завеликий: зображення до ${MAX_UPLOAD_BYTES / 1024 / 1024} МБ`,
      );
    }
    const { filename, url } = await processUpload(ADMIN_IMAGE_PROFILE, file);
    return { filename, url };
  }

  @Post('public')
  @Throttle({
    default: { limit: PUBLIC_UPLOAD_LIMIT_PER_IP, ttl: THROTTLE_TTL },
  })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload a file publicly: a payment receipt, a costume photo or a registration answer',
  })
  @ApiBody(fileBody)
  @UseInterceptors(PublicUploadQuotaInterceptor, publicUpload)
  async uploadPublic(
    @Req() req: Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const kind = file ? kindOf(extname(file.filename)) : null;
    if (file && kind && file.size > KIND_MAX_BYTES[kind]) {
      removeQuietly(file.path);
      throw new PayloadTooLargeException(tooLargeMessage(kind));
    }
    const { filename, url, size } = await processUpload(
      PUBLIC_IMAGE_PROFILE,
      file,
    );
    await this.publicUploads.record(filename, size, clientIpHash(req));
    return { filename, url };
  }
}
