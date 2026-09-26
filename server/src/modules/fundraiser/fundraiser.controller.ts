import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { Admin } from '../../auth/admin.decorator';
import { ApiPaginatedResponse } from '../../common/dto/paginated.dto';
import { CreateFundraiserDto } from './dto/create-fundraiser.dto';
import { FundraiserQueryDto } from './dto/fundraiser-query.dto';
import { JarPreviewDto } from './dto/jar-preview.dto';
import { UpdateFundraiserDto } from './dto/update-fundraiser.dto';
import { FundraiserEntity } from './entities/fundraiser.entity';
import { JarPreviewEntity } from './entities/jar-preview.entity';
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

  @Post('jar-preview')
  @Admin()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Check a Monobank jar widget link and return its current amount and goal (admin)',
  })
  @ApiOkResponse({ type: JarPreviewEntity })
  previewJar(@Body() dto: JarPreviewDto) {
    return this.fundraiserService.previewJar(dto.jarWidgetUrl);
  }

  @Get()
  @ApiOperation({ summary: 'List fundraisers, optionally filtered by status' })
  @ApiPaginatedResponse(FundraiserEntity)
  findAll(@Query() query: FundraiserQueryDto) {
    return this.fundraiserService.findAll(query, query.status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a fundraiser by id' })
  @ApiOkResponse({ type: FundraiserEntity })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.fundraiserService.findOne(id);
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
