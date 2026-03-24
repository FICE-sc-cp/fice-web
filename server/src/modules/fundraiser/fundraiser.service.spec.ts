import { Test, TestingModule } from '@nestjs/testing';
import { FundraiserService } from './fundraiser.service';

describe('FundraiserService', () => {
  let service: FundraiserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FundraiserService],
    }).compile();

    service = module.get<FundraiserService>(FundraiserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
