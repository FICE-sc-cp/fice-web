import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentHeadController } from './department_head.controller';
import { DepartmentHeadService } from './department_head.service';

describe('DepartmentHeadController', () => {
  let controller: DepartmentHeadController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentHeadController],
      providers: [DepartmentHeadService],
    }).compile();

    controller = module.get<DepartmentHeadController>(DepartmentHeadController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
