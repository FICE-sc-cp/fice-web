import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentHeadService } from './department_head.service';

describe('DepartmentHeadService', () => {
  let service: DepartmentHeadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DepartmentHeadService],
    }).compile();

    service = module.get<DepartmentHeadService>(DepartmentHeadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
