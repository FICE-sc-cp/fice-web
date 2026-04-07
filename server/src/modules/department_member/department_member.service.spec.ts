import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentMemberService } from './department_member.service';

describe('DepartmentMemberService', () => {
  let service: DepartmentMemberService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DepartmentMemberService],
    }).compile();

    service = module.get<DepartmentMemberService>(DepartmentMemberService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
