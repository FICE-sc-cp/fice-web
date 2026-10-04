import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { Admin } from '../../auth/admin.decorator';
import { DownloadTokenService } from '../../auth/download-token.service';
import {
  MAX_ARCHIVE_BYTES,
  PeopleArchiveError,
  readPeopleArchive,
} from './people-import';
import { BotService } from '../../bot/bot.service';
import { CreateProjectParticipantDto } from './dto/create-project-participant.dto';
import { UpdateProjectParticipantDto } from './dto/update-project-participant.dto';
import { ProjectParticipantEntity } from './entities/project-participant.entity';
import { ProjectParticipantService } from './project_participant.service';

@ApiTags('project-participants')
@Controller('project-participant')
export class ProjectParticipantController {
  constructor(
    private readonly service: ProjectParticipantService,
    private readonly botService: BotService,
    private readonly downloads: DownloadTokenService,
  ) {}

  private async sendExportConfig(res: Response) {
    const config = await this.service.exportConfig();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="people-wall-config.json"',
    );
    res.send(JSON.stringify(config, null, 2));
  }

  @Get('export-config')
  @Admin()
  @ApiOperation({
    summary:
      'Download the config for the people-wall export tool: departments and their Telegram chats (admin)',
  })
  exportConfig(@Res() res: Response) {
    return this.sendExportConfig(res);
  }

  @Post('export-config-link')
  @Admin()
  @ApiOperation({
    summary: 'Create a one-time, 2-minute link to the export config (admin)',
  })
  createExportConfigLink() {
    const token = this.downloads.issue('people-wall-config');
    return { path: `/project-participant/export-config-file?token=${token}` };
  }

  @Get('export-config-file')
  @ApiOperation({ summary: 'Download the export config with a one-time link' })
  exportConfigFile(
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ) {
    this.downloads.redeem(token, 'people-wall-config');
    return this.sendExportConfig(res);
  }

  @Post('import')
  @Admin()
  @ApiOperation({
    summary:
      'Import people from the export tool archive into the department walls (admin)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_ARCHIVE_BYTES, files: 1, fields: 0, parts: 1 },
    }),
  )
  importPeople(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Додай архів експорту (поле "file").');
    }
    let archive;
    try {
      archive = readPeopleArchive(file.buffer);
    } catch (err) {
      if (err instanceof PeopleArchiveError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
    return this.service.importPeople(archive);
  }

  @Post('sync')
  @Admin()
  @ApiOperation({
    summary:
      'Sync participants with Telegram chats (remove left/kicked members)',
  })
  @ApiQuery({ name: 'departmentId', required: false, format: 'uuid' })
  sync(
    @Query('departmentId', new ParseUUIDPipe({ optional: true }))
    departmentId?: string,
  ) {
    return this.botService.syncDepartmentChatMembers(departmentId);
  }

  // Public: consumed by the department people walls ("сердечка").
  @Get('public')
  @ApiOperation({
    summary: 'Public list of visible participants (name + avatar)',
  })
  @ApiQuery({ name: 'departmentId', required: false, format: 'uuid' })
  findPublic(
    @Query('departmentId', new ParseUUIDPipe({ optional: true }))
    departmentId?: string,
  ) {
    return this.service.findPublic(departmentId);
  }

  @Get()
  @Admin()
  @ApiOperation({
    summary: 'List all project participants incl. hidden (admin)',
  })
  @ApiOkResponse({ type: [ProjectParticipantEntity] })
  findAll() {
    return this.service.findAllAdmin();
  }

  @Post()
  @Admin()
  @ApiOperation({ summary: 'Manually add a project participant (admin)' })
  @ApiOkResponse({ type: ProjectParticipantEntity })
  create(@Body() dto: CreateProjectParticipantDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Admin()
  @ApiOperation({
    summary: 'Edit / hide / unhide a project participant (admin)',
  })
  @ApiOkResponse({ type: ProjectParticipantEntity })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectParticipantDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'Delete a project participant (admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
