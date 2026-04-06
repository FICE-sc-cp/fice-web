import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DepartmentHeadService } from './department_head.service';
import { CreateDepartmentHeadDto } from './dto/create-department_head.dto';
import { UpdateDepartmentHeadDto } from './dto/update-department_head.dto';

@Controller('department-head')
export class DepartmentHeadController {
  constructor(private readonly departmentHeadService: DepartmentHeadService) {}

  @Post()
  create(@Body() createDepartmentHeadDto: CreateDepartmentHeadDto) {
    return this.departmentHeadService.create(createDepartmentHeadDto);
  }

  @Get()
  findAll() {
    return this.departmentHeadService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.departmentHeadService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDepartmentHeadDto: UpdateDepartmentHeadDto) {
    return this.departmentHeadService.update(+id, updateDepartmentHeadDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.departmentHeadService.remove(+id);
  }
}
