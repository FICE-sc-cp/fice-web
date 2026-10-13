import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  ResolvedTelegramUser,
  resolveValidatedTelegramUser,
} from '../../auth/init-data.util';
import {
  AddCandidateDto,
  AddNoteDto,
  BookSlotDto,
  CreateSlotsDto,
  SetSlotMinutesDto,
  SetStatusDto,
  TelegramTagDto,
} from './interview.dto';
import { InterviewService } from './interview.service';

/** Interview booking mini-app; every call is authenticated by the interview bot's init data. */
@ApiTags('interview')
@ApiSecurity('telegram')
@Controller('interview')
export class InterviewController {
  constructor(
    private readonly interviews: InterviewService,
    private readonly config: ConfigService,
  ) {}

  private user(req: Request): ResolvedTelegramUser {
    const initData = req.headers['x-telegram-init-data'];
    const { tgUserId, tgTag } = req.query;
    return resolveValidatedTelegramUser(
      this.config,
      typeof initData === 'string' ? initData : undefined,
      {
        id: typeof tgUserId === 'string' ? tgUserId : undefined,
        tag: typeof tgTag === 'string' ? tgTag : undefined,
      },
      ['INTERVIEW_BOT_TOKEN'],
    );
  }

  @Get('me')
  @ApiOperation({
    summary: 'Roles, own interviews and, for staff, departments',
  })
  me(@Req() req: Request) {
    return this.interviews.me(this.user(req));
  }

  @Get('candidacies/:id/slots')
  @ApiOperation({ summary: 'Free times a candidate can book' })
  freeSlots(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.interviews.freeSlots(this.user(req), id);
  }

  @Post('candidacies/:id/book')
  @ApiOperation({ summary: 'Book or move the candidate interview' })
  book(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BookSlotDto,
  ) {
    return this.interviews.book(this.user(req), id, dto.slotId);
  }

  @Post('slots')
  @ApiOperation({ summary: 'Offer a time window, split into slots' })
  createSlots(@Req() req: Request, @Body() dto: CreateSlotsDto) {
    return this.interviews.createSlots(this.user(req), dto);
  }

  @Delete('slots/:id')
  @ApiOperation({ summary: 'Delete a free slot' })
  deleteSlot(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.interviews.deleteSlot(this.user(req), id);
  }

  @Post('candidates')
  @ApiOperation({ summary: 'Add a candidate to a department (head)' })
  addCandidate(@Req() req: Request, @Body() dto: AddCandidateDto) {
    return this.interviews.addCandidate(this.user(req), dto);
  }

  @Patch('candidates/:id')
  @ApiOperation({ summary: 'Set the interview result' })
  setStatus(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStatusDto,
  ) {
    return this.interviews.setStatus(this.user(req), id, dto.status);
  }

  @Delete('candidates/:id')
  @ApiOperation({ summary: 'Remove a candidate (head)' })
  removeCandidate(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.interviews.removeCandidate(this.user(req), id);
  }

  @Post('candidates/:id/notes')
  @ApiOperation({ summary: 'Add an internal note about a candidate' })
  addNote(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddNoteDto,
  ) {
    return this.interviews.addNote(this.user(req), id, dto.text);
  }

  @Delete('notes/:id')
  @ApiOperation({ summary: 'Delete your own note' })
  deleteNote(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.interviews.deleteNote(this.user(req), id);
  }

  @Get('departments/:id/applicants')
  @ApiOperation({ summary: 'Site applications not yet invited (head)' })
  applicants(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.interviews.applicants(this.user(req), id);
  }

  @Patch('departments/:id')
  @ApiOperation({ summary: 'Set the slot length (head)' })
  setSlotMinutes(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetSlotMinutesDto,
  ) {
    return this.interviews.setSlotMinutes(this.user(req), id, dto.slotMinutes);
  }

  @Post('departments/:id/recruiters')
  @ApiOperation({ summary: 'Add a recruiter (head)' })
  addRecruiter(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TelegramTagDto,
  ) {
    return this.interviews.addRecruiter(this.user(req), id, dto.telegramTag);
  }

  @Delete('recruiters/:id')
  @ApiOperation({ summary: 'Remove a recruiter (head)' })
  removeRecruiter(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.interviews.removeRecruiter(this.user(req), id);
  }
}
