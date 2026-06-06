import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Admin } from '../../auth/admin.decorator';
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

  @Delete('overrides/:key')
  @Admin()
  @ApiOperation({ summary: 'Remove a stat override (admin)' })
  removeOverride(@Param('key') key: string) {
    return this.factsService.removeOverride(key);
  }
}
