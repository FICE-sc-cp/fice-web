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
import { AssignDepartmentDto } from './dto/assign-department.dto';
import { CreateDepartmentMemberDto } from './dto/create-department-member.dto';
import { UpdateDepartmentMemberDto } from './dto/update-department-member.dto';
import { DepartmentMemberEntity } from './entities/department-member.entity';
import { DepartmentMemberService } from './department_member.service';

@ApiTags('department-members')
@Controller('department-member')
export class DepartmentMemberController {
  constructor(
    private readonly departmentMemberService: DepartmentMemberService,
  ) {}

  @Post()
  @Admin()
  @ApiOperation({ summary: 'Create a department member (admin)' })
  @ApiCreatedResponse({ type: DepartmentMemberEntity })
  create(@Body() dto: CreateDepartmentMemberDto) {
    return this.departmentMemberService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List department members with their departments' })
  @ApiOkResponse({ type: [DepartmentMemberEntity] })
  findAll() {
    return this.departmentMemberService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a department member by id' })
  @ApiOkResponse({ type: DepartmentMemberEntity })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentMemberService.findOne(id);
  }

  @Patch(':id')
  @Admin()
  @ApiOperation({ summary: 'Update a department member (admin)' })
  @ApiOkResponse({ type: DepartmentMemberEntity })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentMemberDto,
  ) {
    return this.departmentMemberService.update(id, dto);
  }

  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'Delete a department member (admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.departmentMemberService.remove(id);
  }

  @Post(':id/assignments')
  @Admin()
  @ApiOperation({ summary: 'Assign a member to a department (admin)' })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignDepartmentDto,
  ) {
    return this.departmentMemberService.assignToDepartment(
      id,
      dto.departmentId,
    );
  }

  @Delete(':id/assignments/:departmentId')
  @Admin()
  @ApiOperation({ summary: 'Remove a member from a department (admin)' })
  unassign(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
  ) {
    return this.departmentMemberService.removeFromDepartment(id, departmentId);
  }
}
