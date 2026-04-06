import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DepartmentMemberService } from './department_member.service';
import { CreateDepartmentMemberDto } from './dto/create-department_member.dto';
import { UpdateDepartmentMemberDto } from './dto/update-department_member.dto';

@Controller('department-member')
export class DepartmentMemberController {
  constructor(private readonly departmentMemberService: DepartmentMemberService) {}

  @Post()
  create(@Body() createDepartmentMemberDto: CreateDepartmentMemberDto) {
    return this.departmentMemberService.create(createDepartmentMemberDto);
  }

  @Get()
  findAll() {
    return this.departmentMemberService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.departmentMemberService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDepartmentMemberDto: UpdateDepartmentMemberDto) {
    return this.departmentMemberService.update(+id, updateDepartmentMemberDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.departmentMemberService.remove(+id);
  }
}
