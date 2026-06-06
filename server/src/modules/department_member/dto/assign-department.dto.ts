import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignDepartmentDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Department to assign the member to',
  })
  @IsUUID()
  departmentId: string;
}
