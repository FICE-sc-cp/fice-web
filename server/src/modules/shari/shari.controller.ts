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
  Put,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { resolveTelegramLogin } from '../../auth/telegram-login.util';
import { sendXlsx } from '../../common/xlsx-response';
import {
  AddTeacherDto,
  AwardsDto,
  CreateShariDto,
  ShariSettingsDto,
  TeacherContactsDto,
  UpdateSharaDto,
} from './shari.dto';
import { ShariService } from './shari.service';

/** Imports are pasted text or a file, sent as one multipart file (the JSON body limit is 100 KB). */
const TextFile = () =>
  UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
    }),
  );

function text(file?: Express.Multer.File): string {
  if (!file)
    throw new BadRequestException('Додай файл або текст (поле "file")');
  return file.buffer.toString('utf8');
}

/**
 * Шари. Teachers call with their personal link token (`x-shari-token`);
 * starostas and the presidium with Telegram Login Widget data
 * (`x-telegram-login`, the widget's user object as a query string).
 */
@ApiTags('shari')
@Controller('shari')
export class ShariController {
  constructor(
    private readonly shari: ShariService,
    private readonly config: ConfigService,
  ) {}

  private token(req: Request): string | undefined {
    const token = req.headers['x-shari-token'];
    return typeof token === 'string' ? token : undefined;
  }

  private user(req: Request) {
    const login = req.headers['x-telegram-login'];
    const { tgUserId, tgTag } = req.query;
    return resolveTelegramLogin(
      this.config,
      typeof login === 'string' ? login : undefined,
      {
        id: typeof tgUserId === 'string' ? tgUserId : undefined,
        tag: typeof tgTag === 'string' ? tgTag : undefined,
      },
    );
  }

  // ---- Teacher -------------------------------------------------------------

  @Get('teacher')
  @ApiOperation({
    summary: 'The teacher behind a personal link and their shari',
  })
  teacher(@Req() req: Request) {
    return this.shari.teacherView(this.token(req));
  }

  @Patch('teacher')
  @ApiOperation({ summary: 'Set the teacher email / Telegram' })
  setContacts(@Req() req: Request, @Body() dto: TeacherContactsDto) {
    return this.shari.setContacts(this.token(req), dto);
  }

  @Post('teacher/shari')
  @ApiOperation({ summary: 'Give the same shara to each of the chosen groups' })
  addShari(@Req() req: Request, @Body() dto: CreateShariDto) {
    return this.shari.addShari(this.token(req), dto);
  }

  @Patch('teacher/shari/:id')
  @ApiOperation({ summary: 'Change own shara' })
  updateShara(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSharaDto,
  ) {
    return this.shari.updateShara(this.token(req), id, dto);
  }

  @Delete('teacher/shari/:id')
  @ApiOperation({ summary: 'Withdraw own shara nobody got yet' })
  deleteShara(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.shari.deleteShara(this.token(req), id);
  }

  // ---- Starosta & presidium ------------------------------------------------

  @Get('me')
  @ApiOperation({
    summary: 'Who is signed in: presidium and/or the starosta of a group',
  })
  me(@Req() req: Request) {
    return this.shari.me(this.user(req));
  }

  @Get('groups/:group')
  @ApiOperation({ summary: 'Shari of a group, its students and recipients' })
  group(@Req() req: Request, @Param('group') group: string) {
    return this.shari.groupView(this.user(req), group);
  }

  @Put('shari/:id/awards')
  @ApiOperation({ summary: 'Set who gets each place of a shara' })
  setAwards(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AwardsDto,
  ) {
    return this.shari.setAwards(this.user(req), id, dto.names);
  }

  @Get('awards/:id/certificate')
  @ApiOperation({ summary: 'What a certificate shows, with its QR code' })
  certificate(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.shari.certificate(this.user(req), id);
  }

  // ---- Presidium -----------------------------------------------------------

  @Get('admin')
  @ApiOperation({
    summary: 'Teachers, groups, progress and settings (presidium)',
  })
  admin(@Req() req: Request) {
    return this.shari.adminView(this.user(req));
  }

  @Patch('admin/settings')
  @ApiOperation({ summary: 'Open or close teacher input and starosta edits' })
  setSettings(@Req() req: Request, @Body() dto: ShariSettingsDto) {
    return this.shari.setSettings(this.user(req), dto);
  }

  @Post('admin/teachers/import')
  @ApiConsumes('multipart/form-data')
  @TextFile()
  @ApiOperation({ summary: 'Import the campus teacher CSV (presidium)' })
  importTeachers(
    @Req() req: Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.shari.importTeachers(this.user(req), text(file));
  }

  @Post('admin/teachers')
  @ApiOperation({ summary: 'Add a teacher missing from the schedule' })
  addTeacher(@Req() req: Request, @Body() dto: AddTeacherDto) {
    return this.shari.addTeacher(this.user(req), dto);
  }

  @Post('admin/teachers/:id/link')
  @ApiOperation({
    summary: 'Issue a new personal link (the old one stops working)',
  })
  reissueLink(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.shari.reissueLink(this.user(req), id);
  }

  @Post('admin/starostas')
  @ApiConsumes('multipart/form-data')
  @TextFile()
  @ApiOperation({ summary: 'Set starostas from "group ⇥ @tag" lines' })
  importStarostas(
    @Req() req: Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.shari.importStarostas(this.user(req), text(file));
  }

  @Post('admin/students')
  @ApiConsumes('multipart/form-data')
  @TextFile()
  @ApiOperation({
    summary: 'Replace student lists from "group ⇥ full name" lines',
  })
  importStudents(
    @Req() req: Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.shari.importStudents(this.user(req), text(file));
  }

  @Delete('admin/shari/:id')
  @ApiOperation({ summary: 'Delete any shara with its recipients (presidium)' })
  removeShara(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.shari.removeShara(this.user(req), id);
  }

  @Get('admin/export')
  @ApiOperation({ summary: 'Everything as Excel (presidium)' })
  async export(@Req() req: Request, @Res() res: Response) {
    sendXlsx(res, await this.shari.exportXlsx(this.user(req)), 'shari.xlsx');
  }

  // ---- Public --------------------------------------------------------------

  @Get('check/:id')
  @ApiOperation({ summary: 'Check a certificate by the id in its QR code' })
  check(@Param('id', ParseUUIDPipe) id: string) {
    return this.shari.check(id);
  }
}
