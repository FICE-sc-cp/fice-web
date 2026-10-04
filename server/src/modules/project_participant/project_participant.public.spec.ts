import { ProjectParticipantService } from './project_participant.service';

describe('ProjectParticipantService.findPublic', () => {
  it('returns names and photos but never @usernames', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ProjectParticipantService({
      projectParticipant: { findMany },
    } as never);

    await service.findPublic('dept-1');

    expect(findMany).toHaveBeenCalledWith({
      where: { hidden: false, departmentId: 'dept-1' },
      select: { fullName: true, photo: true },
      orderBy: { fullName: 'asc' },
    });
  });
});
