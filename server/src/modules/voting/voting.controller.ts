import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { validate } from '@tma.js/init-data-node';
import type { Response } from 'express';
import { Admin } from '../../auth/admin.decorator';
import { extractTelegramUser } from '../../auth/init-data.util';
import { CastVoteDto } from './dto/cast-vote.dto';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { CreateVotingDto } from './dto/create-voting.dto';
import { SubmitCandidateDto } from './dto/submit-candidate.dto';
import { UpdateVotingDto } from './dto/update-voting.dto';
import { VotingService } from './voting.service';

@ApiTags('voting')
@Controller('voting')
export class VotingController {
  constructor(
    private readonly votingService: VotingService,
    private readonly config: ConfigService,
  ) {}

  private resolveTelegramId(initData?: string, fallbackId?: string): bigint {
    if (this.config.get<string>('AUTH_DISABLED') === 'true' && fallbackId) {
      return BigInt(fallbackId);
    }

    const token =
      this.config.get<string>('USER_BOT_TOKEN') ||
      this.config.get<string>('TELEGRAM_BOT_TOKEN');

    if (!initData) {
      if (fallbackId && this.config.get<string>('AUTH_DISABLED') === 'true') {
        return BigInt(fallbackId);
      }
      throw new UnauthorizedException('Відсутні дані авторизації Telegram');
    }

    if (token) {
      try {
        validate(initData, token);
      } catch {
        if (this.config.get<string>('AUTH_DISABLED') !== 'true') {
          throw new UnauthorizedException('Невалідні дані Telegram');
        }
      }
    }

    const user = extractTelegramUser(initData);
    if (!user) {
      throw new UnauthorizedException('Не вдалося розпізнати користувача Telegram');
    }
    return BigInt(user.id);
  }

  // --- Admin endpoints ---

  @Get('event/:eventId')
  @Admin()
  @ApiOperation({ summary: 'Get all votings for an event (admin)' })
  getEventVotings(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.votingService.getEventVotings(eventId);
  }

  @Post('event/:eventId')
  @Admin()
  @ApiOperation({ summary: 'Create a voting for an event (admin)' })
  createVoting(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateVotingDto,
  ) {
    return this.votingService.createVoting(eventId, dto);
  }

  @Get(':id')
  @Admin()
  @ApiOperation({ summary: 'Get voting details by id (admin)' })
  getVoting(@Param('id', ParseUUIDPipe) id: string) {
    return this.votingService.getVoting(id);
  }

  @Patch(':id')
  @Admin()
  @ApiOperation({ summary: 'Update voting parameters / status (admin)' })
  updateVoting(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVotingDto,
  ) {
    return this.votingService.updateVoting(id, dto);
  }

  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'Delete a voting (admin)' })
  deleteVoting(@Param('id', ParseUUIDPipe) id: string) {
    return this.votingService.deleteVoting(id);
  }

  @Post(':id/candidates')
  @Admin()
  @ApiOperation({ summary: 'Add a candidate to a voting (admin)' })
  addCandidate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCandidateDto,
  ) {
    return this.votingService.addCandidate(id, dto);
  }

  @Patch('candidates/:candidateId')
  @Admin()
  @ApiOperation({ summary: 'Update a candidate (admin)' })
  updateCandidate(
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
    @Body() dto: UpdateCandidateDto,
  ) {
    return this.votingService.updateCandidate(candidateId, dto);
  }

  @Delete('candidates/:candidateId')
  @Admin()
  @ApiOperation({ summary: 'Delete a candidate (admin)' })
  deleteCandidate(@Param('candidateId', ParseUUIDPipe) candidateId: string) {
    return this.votingService.deleteCandidate(candidateId);
  }

  @Get(':id/results')
  @Admin()
  @ApiOperation({ summary: 'Get voting results and voter details (admin)' })
  getResults(@Param('id', ParseUUIDPipe) id: string) {
    return this.votingService.getResults(id);
  }

  @Get(':id/results/export')
  @Admin()
  @ApiOperation({ summary: 'Download voting results as Excel (admin)' })
  async exportResults(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.votingService.exportResults(id);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="voting-${id}-results.xlsx"`,
      'Content-Length': buffer.length.toString(),
    });
    res.send(buffer);
  }

  @Post(':id/notify')
  @Admin()
  @ApiOperation({ summary: 'Broadcast voting launch to event attendees (admin)' })
  notifyVotingStarted(@Param('id', ParseUUIDPipe) id: string) {
    return this.votingService.notifyVotingStarted(id);
  }

  @Get(':id/submissions')
  @Admin()
  @ApiOperation({ summary: 'Get candidate submissions for moderation (admin)' })
  getSubmissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('status') status?: string,
  ) {
    return this.votingService.getSubmissions(id, status as any);
  }

  @Post('submissions/:candidateId/approve')
  @Admin()
  @ApiOperation({ summary: 'Approve a candidate submission (admin)' })
  approveSubmission(@Param('candidateId', ParseUUIDPipe) candidateId: string) {
    return this.votingService.approveCandidate(candidateId);
  }

  @Post('submissions/:candidateId/reject')
  @Admin()
  @ApiOperation({ summary: 'Reject a candidate submission (admin)' })
  rejectSubmission(
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
    @Body('reason') reason?: string,
  ) {
    return this.votingService.rejectCandidate(candidateId, reason);
  }

  // --- Client / Mini App endpoints ---

  @Get('event/:eventId/public')
  @ApiOperation({ summary: 'Get active/closed votings for an event (public)' })
  getPublicEventVotings(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.votingService.getPublicEventVotings(eventId);
  }

  @Get(':id/public')
  @ApiOperation({ summary: 'Get voting for Mini App (public)' })
  getPublicVoting(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-telegram-init-data') initData?: string,
    @Query('tgUserId') fallbackId?: string,
  ) {
    let telegramId: bigint | undefined;
    try {
      if (initData || fallbackId) {
        telegramId = this.resolveTelegramId(initData, fallbackId);
      }
    } catch {}

    return this.votingService.getPublicVoting(id, telegramId);
  }

  @Get(':id/screen')
  @ApiOperation({ summary: 'Get live results for stage/projector screen (public)' })
  getLiveScreenData(@Param('id', ParseUUIDPipe) id: string) {
    return this.votingService.getLiveScreenData(id);
  }

  @Post(':id/submit-candidate')
  @ApiSecurity('telegram')
  @ApiOperation({ summary: 'Submit a costume/candidate entry (Mini App)' })
  submitCandidate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitCandidateDto,
    @Headers('x-telegram-init-data') initData?: string,
    @Query('tgUserId') fallbackId?: string,
  ) {
    const telegramId = this.resolveTelegramId(initData, fallbackId);
    let username: string | undefined;
    let fullName: string | undefined;

    if (initData) {
      const user = extractTelegramUser(initData);
      if (user) {
        username = user.username;
        fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined;
      }
    }

    return this.votingService.submitCandidate(id, telegramId, dto, username, fullName);
  }

  @Post(':id/vote')
  @ApiSecurity('telegram')
  @ApiOperation({ summary: 'Cast a vote in a voting (Mini App)' })
  castVote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CastVoteDto,
    @Headers('x-telegram-init-data') initData?: string,
    @Query('tgUserId') fallbackId?: string,
  ) {
    const telegramId = this.resolveTelegramId(initData, fallbackId);
    return this.votingService.castVote(id, telegramId, dto);
  }
}
