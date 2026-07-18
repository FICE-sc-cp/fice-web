import { ApiProperty } from '@nestjs/swagger';
import { ProjectParticipantSource } from '@prisma/client';

export class ProjectParticipantEntity {
  id: string;
  fullName: string;
  telegramTag: string | null;
  photo: string | null;

  @ApiProperty({ enum: ProjectParticipantSource })
  source: ProjectParticipantSource;

  hidden: boolean;
  lastSeenAt: Date;
  createdAt: Date;
}
