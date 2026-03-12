import { Test, TestingModule } from '@nestjs/testing';
import { BotService } from './bot.service';
import { ConfigService } from '@nestjs/config';

describe('BotService', () => {
  let service: BotService;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'TELEGRAM_BOT_TOKEN') return 'MOCK_TOKEN';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<BotService>(BotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
