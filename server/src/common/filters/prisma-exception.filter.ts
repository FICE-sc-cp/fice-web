import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/**
 * Translates known Prisma errors into clean HTTP responses so services can rely
 * on the database to enforce invariants instead of pre-checking everything:
 *   - P2025 (record not found)        -> 404
 *   - P2002 (unique constraint)       -> 409
 *   - P2003 (foreign key constraint)  -> 400
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.BAD_REQUEST;
    let message = 'Database request error';

    switch (exception.code) {
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message =
          (exception.meta?.cause as string | undefined) ?? 'Record not found';
        break;
      case 'P2002': {
        status = HttpStatus.CONFLICT;
        const target = exception.meta?.target as string[] | string | undefined;
        const fields = Array.isArray(target) ? target.join(', ') : target;
        message = `A record with this ${fields ?? 'value'} already exists`;
        break;
      }
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message = 'Related record not found (foreign key constraint failed)';
        break;
      default:
        this.logger.error(
          `Unhandled Prisma error ${exception.code}: ${exception.message}`,
        );
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: exception.code,
    });
  }
}
