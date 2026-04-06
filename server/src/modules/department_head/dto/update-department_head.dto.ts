import { PartialType } from '@nestjs/swagger';
import { CreateDepartmentHeadDto } from './create-department_head.dto';

export class UpdateDepartmentHeadDto extends PartialType(CreateDepartmentHeadDto) {}
