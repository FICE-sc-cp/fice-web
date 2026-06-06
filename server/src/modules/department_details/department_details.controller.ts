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
import { CreateDepartmentDetailsDto } from './dto/create-department-details.dto';
import { UpdateDepartmentDetailsDto } from './dto/update-department-details.dto';
import { DepartmentDetailsEntity } from './entities/department-details.entity';
import { DepartmentDetailsService } from './department_details.service';

@ApiTags('department-details')
@Controller('department-details')
export class DepartmentDetailsController {
  constructor(
    private readonly departmentDetailsService: DepartmentDetailsService,
  ) {}

  @Post()
  @Admin()
  @ApiOperation({ summary: 'Create department details (admin)' })
  @ApiCreatedResponse({ type: DepartmentDetailsEntity })
  create(@Body() dto: CreateDepartmentDetailsDto) {
    return this.departmentDetailsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List department details' })
  @ApiOkResponse({ type: [DepartmentDetailsEntity] })
  findAll() {
    return this.departmentDetailsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get department details by id' })
  @ApiOkResponse({ type: DepartmentDetailsEntity })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentDetailsService.findOne(id);
  }

  @Patch(':id')
  @Admin()
  @ApiOperation({ summary: 'Update department details (admin)' })
  @ApiOkResponse({ type: DepartmentDetailsEntity })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDetailsDto,
  ) {
    return this.departmentDetailsService.update(id, dto);
  }

  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'Delete department details (admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentDetailsService.remove(id);
  }
}
