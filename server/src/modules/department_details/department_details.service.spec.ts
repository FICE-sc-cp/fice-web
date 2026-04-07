import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentDetailsService } from './department_details.service';

describe('DepartmentDetailsService', () => {
  let service: DepartmentDetailsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DepartmentDetailsService],
    }).compile();

    service = module.get<DepartmentDetailsService>(DepartmentDetailsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
