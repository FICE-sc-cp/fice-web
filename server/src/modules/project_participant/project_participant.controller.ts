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
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Admin } from '../../auth/admin.decorator';
import { CreateProjectParticipantDto } from './dto/create-project-participant.dto';
import { UpdateProjectParticipantDto } from './dto/update-project-participant.dto';
import { ProjectParticipantEntity } from './entities/project-participant.entity';
import { ProjectParticipantService } from './project_participant.service';

@ApiTags('project-participants')
@Controller('project-participant')
export class ProjectParticipantController {
  constructor(private readonly service: ProjectParticipantService) {}

  // Public: consumed by the future "Люди проєктного" wall on the landing.
  @Get('public')
  @ApiOperation({
    summary: 'Public list of visible project participants (name + avatar)',
  })
  findPublic() {
    return this.service.findPublic();
  }

  @Get()
  @Admin()
  @ApiOperation({ summary: 'List all project participants incl. hidden (admin)' })
  @ApiOkResponse({ type: [ProjectParticipantEntity] })
  findAll() {
    return this.service.findAllAdmin();
  }

  @Post()
  @Admin()
  @ApiOperation({ summary: 'Manually add a project participant (admin)' })
  @ApiOkResponse({ type: ProjectParticipantEntity })
  create(@Body() dto: CreateProjectParticipantDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Admin()
  @ApiOperation({ summary: 'Edit / hide / unhide a project participant (admin)' })
  @ApiOkResponse({ type: ProjectParticipantEntity })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectParticipantDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'Delete a project participant (admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
