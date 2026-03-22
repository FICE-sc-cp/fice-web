import { Test, TestingModule } from '@nestjs/testing';
import { EventDetailsController } from './event-details.controller';
import { EventDetailsService } from './event-details.service';

describe('EventDetailsController', () => {
  let controller: EventDetailsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventDetailsController],
      providers: [EventDetailsService],
    }).compile();

    controller = module.get<EventDetailsController>(EventDetailsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
