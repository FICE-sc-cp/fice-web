import { Injectable } from '@nestjs/common';
import { CreateDepartmentMemberDto } from './dto/create-department_member.dto';
import { UpdateDepartmentMemberDto } from './dto/update-department_member.dto';

@Injectable()
export class DepartmentMemberService {
  create(createDepartmentMemberDto: CreateDepartmentMemberDto) {
    return 'This action adds a new departmentMember';
  }

  findAll() {
    return `This action returns all departmentMember`;
  }

  findOne(id: number) {
    return `This action returns a #${id} departmentMember`;
  }

  update(id: number, updateDepartmentMemberDto: UpdateDepartmentMemberDto) {
    return `This action updates a #${id} departmentMember`;
  }

  remove(id: number) {
    return `This action removes a #${id} departmentMember`;
  }
}
