import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({
    summary: 'Liveness/health check, including Telegram bot polling state',
  })
  getHealth(@Res({ passthrough: true }) res: Response) {
    const health = this.appService.getHealth();
    if (health.status !== 'ok') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return health;
  }
}
