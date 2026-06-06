import { PartialType } from '@nestjs/swagger';
import { CreateDepartmentDetailsDto } from './create-department-details.dto';

export class UpdateDepartmentDetailsDto extends PartialType(
  CreateDepartmentDetailsDto,
) {}
