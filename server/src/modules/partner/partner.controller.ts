import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { Admin } from '../../auth/admin.decorator';
import { ApiPaginatedResponse } from '../../common/dto/paginated.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { PartnerEntity } from './entities/partner.entity';
import { PartnerService } from './partner.service';

@ApiTags('partners')
@Controller('partner')
export class PartnerController {
  constructor(private readonly partnerService: PartnerService) {}

  @Post('apply')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Submit a partner application (public)' })
  @ApiCreatedResponse({ type: PartnerEntity })
  apply(@Body() dto: CreatePartnerDto) {
    return this.partnerService.apply(dto);
  }

  @Post()
  @Admin()
  @ApiOperation({ summary: 'Create an approved partner (admin)' })
  @ApiCreatedResponse({ type: PartnerEntity })
  create(@Body() dto: CreatePartnerDto) {
    return this.partnerService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List approved partners' })
  @ApiPaginatedResponse(PartnerEntity)
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.partnerService.findAll(pagination, false);
  }

  @Get('all')
  @Admin()
  @ApiOperation({ summary: 'List all partners, including pending (admin)' })
  @ApiPaginatedResponse(PartnerEntity)
  findAllIncludingPending(@Query() pagination: PaginationQueryDto) {
    return this.partnerService.findAll(pagination, true);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a partner by id' })
  @ApiOkResponse({ type: PartnerEntity })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.partnerService.findOne(id);
  }

  @Patch(':id/approve')
  @Admin()
  @ApiOperation({ summary: 'Approve a partner application (admin)' })
  @ApiOkResponse({ type: PartnerEntity })
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.partnerService.approve(id);
  }

  @Patch(':id')
  @Admin()
  @ApiOperation({ summary: 'Update a partner (admin)' })
  @ApiOkResponse({ type: PartnerEntity })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePartnerDto,
  ) {
    return this.partnerService.update(id, dto);
  }

  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'Delete a partner (admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.partnerService.remove(id);
  }
}
