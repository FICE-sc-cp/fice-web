import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Admin } from '../../auth/admin.decorator';
import { CreateDepartmentHeadDto } from './dto/create-department-head.dto';
import { UpdateDepartmentHeadDto } from './dto/update-department-head.dto';
import { DepartmentHeadEntity } from './entities/department-head.entity';
import { DepartmentHeadService } from './department_head.service';

@ApiTags('department-heads')
@Controller('department-head')
export class DepartmentHeadController {
  constructor(private readonly departmentHeadService: DepartmentHeadService) {}

  @Post()
  @Admin()
  @ApiOperation({ summary: 'Create a department head (admin)' })
  @ApiCreatedResponse({ type: DepartmentHeadEntity })
  create(@Body() dto: CreateDepartmentHeadDto) {
    return this.departmentHeadService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List department heads' })
  @ApiOkResponse({ type: [DepartmentHeadEntity] })
  findAll() {
    return this.departmentHeadService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a department head by id' })
  @ApiOkResponse({ type: DepartmentHeadEntity })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentHeadService.findOne(id);
  }

  @Patch(':id')
  @Admin()
  @ApiOperation({ summary: 'Update a department head (admin)' })
  @ApiOkResponse({ type: DepartmentHeadEntity })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentHeadDto,
  ) {
    return this.departmentHeadService.update(id, dto);
  }

  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'Delete a department head (admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentHeadService.remove(id);
  }
}
