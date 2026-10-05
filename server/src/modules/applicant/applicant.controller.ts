import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { APPLICANT_LIMIT_PER_IP, THROTTLE_TTL } from '../../common/throttle';
import { Admin } from '../../auth/admin.decorator';
import { ApiPaginatedResponse } from '../../common/dto/paginated.dto';
import { ApplicantQueryDto } from './dto/applicant-query.dto';
import { CreateApplicantDto } from './dto/create-applicant.dto';
import { ApplicantEntity } from './entities/applicant.entity';
import { ApplicantService } from './applicant.service';

@ApiTags('applicants')
@Controller('applicant')
export class ApplicantController {
  constructor(private readonly applicantService: ApplicantService) {}

  @Post()
  @Throttle({ default: { limit: APPLICANT_LIMIT_PER_IP, ttl: THROTTLE_TTL } })
  @ApiOperation({ summary: 'Submit a join application (public)' })
  @ApiCreatedResponse({ type: ApplicantEntity })
  create(@Body() dto: CreateApplicantDto) {
    return this.applicantService.create(dto);
  }

  @Post('sync-sheets')
  @Admin()
  @ApiOperation({ summary: 'Sync all applicants to Google Sheets (admin)' })
  syncSheets() {
    return this.applicantService.syncGoogleSheets();
  }

  @Get()
  @Admin()
  @ApiOperation({ summary: 'List join applications (admin)' })
  @ApiPaginatedResponse(ApplicantEntity)
  findAll(@Query() query: ApplicantQueryDto) {
    return this.applicantService.findAll(query);
  }

  @Get(':id')
  @Admin()
  @ApiOperation({ summary: 'Get a join application by id (admin)' })
  @ApiOkResponse({ type: ApplicantEntity })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.applicantService.findOne(id);
  }

  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'Delete a join application (admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.applicantService.remove(id);
  }
}
