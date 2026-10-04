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
import { NewsQueryDto } from './dto/news-query.dto';
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

  @Get(':id')
  @ApiOperation({ summary: 'Get a news item by id' })
  @ApiOkResponse({ type: NewsEntity })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-telegram-init-data') initData?: string,
  ) {
    const news = await this.newsService.findOne(id);
    if (news.isDraft && !(await this.adminAccess.isAdmin(initData))) {
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

  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'Delete a news item (admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.newsService.remove(id);
  }
}
