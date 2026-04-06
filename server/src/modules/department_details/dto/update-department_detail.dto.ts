import { PartialType } from '@nestjs/swagger';
import { CreateDepartmentDetailDto } from './create-department_detail.dto';

export class UpdateDepartmentDetailDto extends PartialType(CreateDepartmentDetailDto) {}
