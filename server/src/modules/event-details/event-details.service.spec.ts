import { Test, TestingModule } from '@nestjs/testing';
import { EventDetailsService } from './event-details.service';

describe('EventDetailsService', () => {
  let service: EventDetailsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventDetailsService],
    }).compile();

    service = module.get<EventDetailsService>(EventDetailsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
