import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Admin } from '../../auth/admin.decorator';
import { SetFactNoteDto } from './dto/set-fact-note.dto';
import { SetStatOverrideDto } from './dto/set-stat-override.dto';
import { FactsService } from './facts.service';

@ApiTags('facts')
@Controller('facts')
export class FactsController {
  constructor(private readonly factsService: FactsService) {}

  @Get()
  @ApiOperation({
    summary: 'Facts & results — computed stats with admin overrides applied',
  })
  getFacts() {
    return this.factsService.getFacts();
  }

  @Get('overrides')
  @Admin()
  @ApiOperation({ summary: 'List manual stat overrides (admin)' })
  listOverrides() {
    return this.factsService.listOverrides();
  }

  @Put('overrides/:key')
  @Admin()
  @ApiOperation({ summary: 'Pin a stat to a manual value (admin)' })
  setOverride(@Param('key') key: string, @Body() dto: SetStatOverrideDto) {
    return this.factsService.setOverride(key, dto.value);
  }

  @Put('notes/:key')
  @Admin()
  @ApiOperation({ summary: 'Set the caption shown under a stat (admin)' })
  setNote(@Param('key') key: string, @Body() dto: SetFactNoteDto) {
    return this.factsService.setNote(key, dto.note);
  }

  @Delete('overrides/:key')
  @Admin()
  @ApiOperation({ summary: 'Remove a stat override (admin)' })
  removeOverride(@Param('key') key: string) {
    return this.factsService.removeOverride(key);
  }
}
