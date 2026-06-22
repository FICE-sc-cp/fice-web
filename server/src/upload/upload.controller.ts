import { randomUUID } from 'crypto';
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

const imageUpload = FileInterceptor('file', {
  storage: diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) =>
      cb(null, `${randomUUID()}${extname(file.originalname)}`),
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new BadRequestException('Only image files are allowed'), false);
      return;
    }
    cb(null, true);
  },
});

function toResult(file?: Express.Multer.File) {
  if (!file) {
    throw new BadRequestException('No file uploaded (field name: "file")');
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
  @UseInterceptors(imageUpload)
  upload(@UploadedFile() file?: Express.Multer.File) {
    return toResult(file);
  }

  @Post('public')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an image publicly (e.g. a payment receipt)' })
  @ApiBody(fileBody)
  @UseInterceptors(imageUpload)
  uploadPublic(@UploadedFile() file?: Express.Multer.File) {
    return toResult(file);
  }
}
