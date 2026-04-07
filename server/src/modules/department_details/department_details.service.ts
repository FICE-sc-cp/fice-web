import { Injectable } from '@nestjs/common';
import { CreateDepartmentDetailDto } from './dto/create-department_detail.dto';
import { UpdateDepartmentDetailDto } from './dto/update-department_detail.dto';

@Injectable()
export class DepartmentDetailsService {
  create(createDepartmentDetailDto: CreateDepartmentDetailDto) {
    return 'This action adds a new departmentDetail';
  }

  findAll() {
    return `This action returns all departmentDetails`;
  }

  findOne(id: number) {
    return `This action returns a #${id} departmentDetail`;
  }

  update(id: number, updateDepartmentDetailDto: UpdateDepartmentDetailDto) {
    return `This action updates a #${id} departmentDetail`;
  }

  remove(id: number) {
    return `This action removes a #${id} departmentDetail`;
  }
}
