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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FundraiserStatus } from '@prisma/client';
import { Admin } from '../../auth/admin.decorator';
import { ApiPaginatedResponse } from '../../common/dto/paginated.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateFundraiserDto } from './dto/create-fundraiser.dto';
import { UpdateFundraiserDto } from './dto/update-fundraiser.dto';
import { CreateDonationDto } from './dto/create-donation.dto';
import { FundraiserEntity } from './entities/fundraiser.entity';
import { DonationEntity } from './entities/donation.entity';
import { FundraiserService } from './fundraiser.service';

@ApiTags('fundraisers')
@Controller('fundraiser')
export class FundraiserController {
  constructor(private readonly fundraiserService: FundraiserService) {}

  @Post()
  @Admin()
  @ApiOperation({ summary: 'Create a fundraiser (admin)' })
  @ApiCreatedResponse({ type: FundraiserEntity })
  create(@Body() dto: CreateFundraiserDto) {
    return this.fundraiserService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List fundraisers, optionally filtered by status' })
  @ApiQuery({ name: 'status', enum: FundraiserStatus, required: false })
  @ApiPaginatedResponse(FundraiserEntity)
  findAll(
    @Query() pagination: PaginationQueryDto,
    @Query('status') status?: FundraiserStatus,
  ) {
    const filter =
      status && Object.values(FundraiserStatus).includes(status)
        ? status
        : undefined;
    return this.fundraiserService.findAll(pagination, filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a fundraiser by id (with recent donations)' })
  @ApiOkResponse({ type: FundraiserEntity })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.fundraiserService.findOne(id);
  }

  @Get(':id/donations')
  @ApiOperation({ summary: 'List recent donations for a fundraiser' })
  @ApiOkResponse({ type: [DonationEntity] })
  donations(@Param('id', ParseUUIDPipe) id: string) {
    return this.fundraiserService.listDonations(id);
  }

  @Post(':id/donations')
  @Admin()
  @ApiOperation({ summary: 'Add a donation; bumps progress + counter (admin)' })
  @ApiCreatedResponse({ type: DonationEntity })
  addDonation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDonationDto,
  ) {
    return this.fundraiserService.addDonation(id, dto);
  }

  @Delete(':id/donations/:donationId')
  @Admin()
  @ApiOperation({ summary: 'Remove a donation; reverts progress + counter (admin)' })
  removeDonation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('donationId', ParseUUIDPipe) donationId: string,
  ) {
    return this.fundraiserService.removeDonation(id, donationId);
  }

  @Patch(':id')
  @Admin()
  @ApiOperation({ summary: 'Update a fundraiser (admin)' })
  @ApiOkResponse({ type: FundraiserEntity })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFundraiserDto,
  ) {
    return this.fundraiserService.update(id, dto);
  }

  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'Delete a fundraiser (admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.fundraiserService.remove(id);
  }
}
