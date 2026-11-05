import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Admin } from '../../auth/admin.decorator';
import { AdminAccessService } from '../../auth/admin-access.service';
import { ApiPaginatedResponse } from '../../common/dto/paginated.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateNewsDto } from './dto/create-news.dto';
import { NewsQueryDto, NewsStatsQueryDto } from './dto/news-query.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { NewsEntity } from './entities/news.entity';
import { NewsService } from './news.service';

@ApiTags('news')
@Controller('news')
export class NewsController {
  constructor(
    private readonly newsService: NewsService,
    private readonly adminAccess: AdminAccessService,
  ) {}

  @Post()
  @Admin()
  @ApiOperation({ summary: 'Publish a news item (admin)' })
  @ApiCreatedResponse({ type: NewsEntity })
  create(@Body() dto: CreateNewsDto) {
    return this.newsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List news, newest first' })
  @ApiPaginatedResponse(NewsEntity)
  async findAll(
    @Query() query: NewsQueryDto,
    @Headers('x-telegram-init-data') initData?: string,
  ) {
    const draft = await this.adminAccess.draftsAllowed(query.draft, initData);
    return this.newsService.findAll({ ...query, draft });
  }

  @Get('stats')
  @Admin()
  @ApiOperation({ summary: 'Published news per category for a period (admin)' })
  stats(@Query() query: NewsStatsQueryDto) {
    return this.newsService.stats(query);
  }

  @Get('featured')
  @ApiOperation({
    summary: 'The main news item: the chosen one, else the latest',
  })
  @ApiOkResponse({ type: NewsEntity })
  findFeatured() {
    return this.newsService.findFeatured();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a news item by id' })
  @ApiOkResponse({ type: NewsEntity })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-telegram-init-data') initData?: string,
  ) {
    const news = await this.newsService.findOne(id);
    const hidden = news.isDraft || news.publishDate > new Date();
    if (hidden && !(await this.adminAccess.isAdmin(initData))) {
      throw new NotFoundException(`News ${id} not found`);
    }
    return news;
  }

  @Patch(':id')
  @Admin()
  @ApiOperation({ summary: 'Update a news item (admin)' })
  @ApiOkResponse({ type: NewsEntity })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateNewsDto) {
    return this.newsService.update(id, dto);
  }

  @Put(':id/featured')
  @Admin()
  @ApiOperation({ summary: 'Make a news item the main one (admin)' })
  @ApiOkResponse({ type: NewsEntity })
  feature(@Param('id', ParseUUIDPipe) id: string) {
    return this.newsService.feature(id);
  }

  @Delete(':id/featured')
  @Admin()
  @ApiOperation({ summary: 'Stop showing a news item as the main one (admin)' })
  @ApiOkResponse({ type: NewsEntity })
  unfeature(@Param('id', ParseUUIDPipe) id: string) {
    return this.newsService.unfeature(id);
  }

  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'Delete a news item (admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.newsService.remove(id);
  }
}
