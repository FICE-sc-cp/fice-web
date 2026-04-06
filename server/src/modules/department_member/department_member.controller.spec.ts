import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentMemberController } from './department_member.controller';
import { DepartmentMemberService } from './department_member.service';

describe('DepartmentMemberController', () => {
  let controller: DepartmentMemberController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentMemberController],
      providers: [DepartmentMemberService],
    }).compile();

    controller = module.get<DepartmentMemberController>(DepartmentMemberController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
