import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DepartmentDetailsService } from './department_details.service';
import { CreateDepartmentDetailDto } from './dto/create-department_detail.dto';
import { UpdateDepartmentDetailDto } from './dto/update-department_detail.dto';

@Controller('department-details')
export class DepartmentDetailsController {
  constructor(private readonly departmentDetailsService: DepartmentDetailsService) {}

  @Post()
  create(@Body() createDepartmentDetailDto: CreateDepartmentDetailDto) {
    return this.departmentDetailsService.create(createDepartmentDetailDto);
  }

  @Get()
  findAll() {
    return this.departmentDetailsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.departmentDetailsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDepartmentDetailDto: UpdateDepartmentDetailDto) {
    return this.departmentDetailsService.update(+id, updateDepartmentDetailDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.departmentDetailsService.remove(+id);
  }
}
