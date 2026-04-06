import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentDetailsController } from './department_details.controller';
import { DepartmentDetailsService } from './department_details.service';

describe('DepartmentDetailsController', () => {
  let controller: DepartmentDetailsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentDetailsController],
      providers: [DepartmentDetailsService],
    }).compile();

    controller = module.get<DepartmentDetailsController>(DepartmentDetailsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
