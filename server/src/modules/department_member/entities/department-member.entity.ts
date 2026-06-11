import { ApiProperty } from '@nestjs/swagger';
import { DepartmentMemberRole } from '@prisma/client';

export class DepartmentMemberEntity {
  id: string;

  @ApiProperty({ enum: DepartmentMemberRole })
  role: DepartmentMemberRole;

  firstName: string;
  lastName: string;
  specialization: string | null;
}
