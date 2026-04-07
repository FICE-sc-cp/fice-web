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

  it('should skip bot startup when the token is missing', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => null),
          },
        },
      ],
    }).compile();

    const missingTokenService = module.get<BotService>(BotService);

    expect(missingTokenService).toBeDefined();
    expect(() => missingTokenService.onModuleInit()).not.toThrow();
    await expect(missingTokenService.onModuleDestroy()).resolves.toBeUndefined();
  });
});
