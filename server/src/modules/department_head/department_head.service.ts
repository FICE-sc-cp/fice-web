import { Injectable } from '@nestjs/common';
import { CreateDepartmentHeadDto } from './dto/create-department_head.dto';
import { UpdateDepartmentHeadDto } from './dto/update-department_head.dto';

@Injectable()
export class DepartmentHeadService {
  create(createDepartmentHeadDto: CreateDepartmentHeadDto) {
    return 'This action adds a new departmentHead';
  }

  findAll() {
    return `This action returns all departmentHead`;
  }

  findOne(id: number) {
    return `This action returns a #${id} departmentHead`;
  }

  update(id: number, updateDepartmentHeadDto: UpdateDepartmentHeadDto) {
    return `This action updates a #${id} departmentHead`;
  }

  remove(id: number) {
    return `This action removes a #${id} departmentHead`;
  }
}
