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
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Admin } from '../../auth/admin.decorator';
import { BlockedUsersService } from './blocked-users.service';
import { CreateBlockedUserDto } from './dto/create-blocked-user.dto';
import { UpdateBlockedUserDto } from './dto/update-blocked-user.dto';

@ApiTags('blocked-users')
@Controller('blocked-users')
export class BlockedUsersController {
  constructor(private readonly service: BlockedUsersService) {}

  @Get()
  @Admin()
  @ApiOperation({ summary: 'List all blocked users (admin)' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by tag, group, faculty' })
  list(@Query('search') search?: string) {
    return this.service.list(search);
  }

  @Post()
  @Admin()
  @ApiOperation({ summary: 'Add or block a user (admin)' })
  create(@Body() dto: CreateBlockedUserDto) {
    return this.service.blockUser(dto);
  }

  @Patch(':id')
  @Admin()
  @ApiOperation({ summary: 'Update blocked user status, group, or faculty (admin)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBlockedUserDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'Delete/unblock a user (admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
