import { ServiceUnavailableException } from '@nestjs/common';
import type { MerchConfig } from '@prisma/client';
import { GrammyError } from 'grammy';
import { MerchBotService } from './merch-bot.service';

const TOKEN = '123:fake';
const CHAT = -100123n;
const FIVE_MINUTES = 5 * 60_000;

const grammyError = (code: number, description: string) =>
  new GrammyError(
    'Call to getChatMember failed!',
    { ok: false, error_code: code, description },
    'getChatMember',
    {},
  );

function build(
  env: Record<string, string> = { MERCH_BOT_TOKEN: TOKEN },
  shop: Partial<MerchConfig> = { adminChatId: CHAT },
) {
  const prisma = {
    merchConfig: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(shop),
      update: jest.fn(),
    },
  };
  const service = new MerchBotService(
    { get: (key: string) => env[key] } as never,
    prisma as never,
  );
  return { service, prisma };
}

describe('MerchBotService without a token', () => {
  it('stays off and nothing throws', async () => {
    const { service } = build({});

    expect(service.enabled).toBe(false);
    expect(service.telegram).toBeUndefined();
    expect(service.getUsername()).toBeUndefined();
    expect(service.pollingStatus()).toBe('disabled');
    expect(() => service.onModuleInit()).not.toThrow();
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(() => service.kick()).not.toThrow();
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    expect(service.pollingStatus()).toBe('disabled');
  });

  it('gives nobody admin rights, without reading the row', async () => {
    const { service, prisma } = build({});

    expect(await service.isShopAdmin(1)).toBe(false);
    expect(prisma.merchConfig.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe('MerchBotService polling', () => {
  const APP_ENV = process.env.APP_ENV;

  afterEach(() => {
    if (APP_ENV === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = APP_ENV;
  });

  const withBot = (env: Record<string, string> = {}) => {
    const { service } = build({ MERCH_BOT_TOKEN: TOKEN, ...env });
    const bot = service.telegram!;
    const start = jest
      .spyOn(bot, 'start')
      .mockImplementation(() => new Promise(() => {}));
    const getMe = jest
      .spyOn(bot.api, 'getMe')
      .mockResolvedValue({ username: 'merch_test_bot' } as never);
    const setMenu = jest
      .spyOn(bot.api, 'setChatMenuButton')
      .mockResolvedValue(true);
    return { service, start, getMe, setMenu };
  };

  it('starts only in onApplicationBootstrap, after every onModuleInit', async () => {
    const { service, start } = withBot();

    service.onModuleInit();
    expect(start).not.toHaveBeenCalled();
    expect(service.pollingStatus()).toBe('disabled');

    await service.onApplicationBootstrap();
    expect(start).toHaveBeenCalledTimes(1);
    expect(service.pollingStatus()).toBe('starting');
  });

  it('wakes the sync loop once polling is allowed, and only then', async () => {
    const allowed = withBot();
    const kick = jest.fn();
    allowed.service.setKick(kick);
    await allowed.service.onApplicationBootstrap();
    expect(kick).toHaveBeenCalledTimes(1);

    const refused = withBot();
    refused.getMe.mockResolvedValue({ username: 'merch_ficebot' } as never);
    const quiet = jest.fn();
    refused.service.setKick(quiet);
    await refused.service.onApplicationBootstrap();
    expect(quiet).not.toHaveBeenCalled();
    expect(refused.service.pollingStatus()).toBe('disabled');
  });

  it('stops polling on shutdown', async () => {
    const { service } = withBot();

    await service.onApplicationBootstrap();
    await service.onModuleDestroy();

    expect(service.pollingStatus()).toBe('stopped');
  });

  it('asks for callback queries and keeps queued updates', async () => {
    const { service, start } = withBot();

    await service.onApplicationBootstrap();

    const options = start.mock.calls[0][0];
    expect(options?.allowed_updates).toEqual(
      expect.arrayContaining(['message', 'callback_query', 'my_chat_member']),
    );
    expect(options?.drop_pending_updates).toBeUndefined();
  });

  it('refuses the real bot outside production', async () => {
    const { service, start, getMe } = withBot();
    getMe.mockResolvedValue({ username: 'merch_ficebot' } as never);

    await service.onApplicationBootstrap();

    expect(start).not.toHaveBeenCalled();
    expect(service.pollingStatus()).toBe('disabled');
  });

  it('refuses when the API does not answer outside production', async () => {
    const { service, start, getMe } = withBot();
    getMe.mockRejectedValue(new Error('network timeout'));

    await service.onApplicationBootstrap();

    expect(start).not.toHaveBeenCalled();
  });

  it('skips the check in production', async () => {
    process.env.APP_ENV = 'production';
    const { service, start, getMe } = withBot();

    await service.onApplicationBootstrap();

    expect(getMe).not.toHaveBeenCalled();
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('learns its username and sets the menu button once polling runs', async () => {
    const { service, start, setMenu } = withBot({
      PUBLIC_WEB_URL: 'https://example.test/',
    });

    await service.onApplicationBootstrap();
    expect(service.getUsername()).toBeUndefined();
    await start.mock.calls[0][0]?.onStart?.({
      username: 'merch_test_bot',
    } as never);

    expect(service.pollingStatus()).toBe('running');
    expect(service.getUsername()).toBe('merch_test_bot');
    expect(setMenu).toHaveBeenCalledWith({
      menu_button: {
        type: 'web_app',
        text: 'Каталог',
        web_app: { url: 'https://example.test/merch-app' },
      },
    });
  });

  it('runs without a menu button when there is no https URL', async () => {
    const { service, start, setMenu } = withBot({
      PUBLIC_WEB_URL: 'http://localhost:3000',
    });

    await service.onApplicationBootstrap();
    await start.mock.calls[0][0]?.onStart?.({
      username: 'merch_test_bot',
    } as never);

    expect(setMenu).not.toHaveBeenCalled();
  });

  it('survives a failed menu button', async () => {
    const { service, start, setMenu } = withBot({
      PUBLIC_WEB_URL: 'https://example.test',
    });
    setMenu.mockRejectedValue(new Error('network timeout'));

    await service.onApplicationBootstrap();
    await expect(
      start.mock.calls[0][0]?.onStart?.({
        username: 'merch_test_bot',
      } as never),
    ).resolves.toBeUndefined();
  });
});

describe('MerchBotService.isShopAdmin', () => {
  const setup = (shop?: Partial<MerchConfig>) => {
    const built = build(undefined, shop);
    const getChatMember = jest.spyOn(
      built.service.telegram!.api,
      'getChatMember',
    );
    return { ...built, getChatMember };
  };

  afterEach(() => jest.restoreAllMocks());

  it('says no to a plain member', async () => {
    const { service, getChatMember } = setup();
    getChatMember.mockResolvedValue({ status: 'member' } as never);

    expect(await service.isShopAdmin(1)).toBe(false);
  });

  it.each(['administrator', 'creator'])('says yes to a %s', async (status) => {
    const { service, getChatMember } = setup();
    getChatMember.mockResolvedValue({ status } as never);

    expect(await service.isShopAdmin(1)).toBe(true);
    expect(getChatMember.mock.calls[0].slice(0, 2)).toEqual([Number(CHAT), 1]);
  });

  it('asks Telegram once inside 5 minutes, and again after', async () => {
    const { service, getChatMember } = setup();
    getChatMember.mockResolvedValue({ status: 'administrator' } as never);
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);

    expect(await service.isShopAdmin(1)).toBe(true);
    clock.mockReturnValue(1_000_000 + FIVE_MINUTES - 1);
    expect(await service.isShopAdmin(1)).toBe(true);
    expect(getChatMember).toHaveBeenCalledTimes(1);

    clock.mockReturnValue(1_000_000 + FIVE_MINUTES);
    expect(await service.isShopAdmin(1)).toBe(true);
    expect(getChatMember).toHaveBeenCalledTimes(2);
  });

  it('caches a no as well', async () => {
    const { service, getChatMember } = setup();
    getChatMember.mockResolvedValue({ status: 'left' } as never);

    expect(await service.isShopAdmin(1)).toBe(false);
    expect(await service.isShopAdmin(1)).toBe(false);
    expect(getChatMember).toHaveBeenCalledTimes(1);
  });

  it('keeps each user apart', async () => {
    const { service, getChatMember } = setup();
    getChatMember
      .mockResolvedValueOnce({ status: 'administrator' } as never)
      .mockResolvedValueOnce({ status: 'member' } as never);

    expect(await service.isShopAdmin(1)).toBe(true);
    expect(await service.isShopAdmin(2)).toBe(false);
  });

  it('answers 503 when Telegram fails and does not cache it', async () => {
    const { service, getChatMember } = setup();
    getChatMember.mockRejectedValueOnce(new Error('network timeout'));

    await expect(service.isShopAdmin(1)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    getChatMember.mockResolvedValueOnce({ status: 'administrator' } as never);
    expect(await service.isShopAdmin(1)).toBe(true);
    expect(getChatMember).toHaveBeenCalledTimes(2);
  });

  it('answers 503 on a Telegram error that says nothing about the member', async () => {
    const { service, getChatMember } = setup();
    getChatMember.mockRejectedValue(
      grammyError(400, 'Bad Request: chat not found'),
    );

    await expect(service.isShopAdmin(1)).rejects.toThrow(
      'Не вдалося перевірити права через Telegram. Спробуйте ще раз за хвилину.',
    );
  });

  it('treats an unknown member as a no', async () => {
    const { service, getChatMember } = setup();
    getChatMember.mockRejectedValue(
      grammyError(400, 'Bad Request: user not found'),
    );

    expect(await service.isShopAdmin(1)).toBe(false);
  });

  it('lets everyone in under AUTH_DISABLED, without Telegram or the row', async () => {
    const { service, prisma } = build({ AUTH_DISABLED: 'true' });

    expect(await service.isShopAdmin(1)).toBe(true);
    expect(prisma.merchConfig.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('says no while no chat is bound', async () => {
    const { service, getChatMember } = setup({ adminChatId: null });

    expect(await service.isShopAdmin(1)).toBe(false);
    expect(getChatMember).not.toHaveBeenCalled();
  });

  it('forgets everything on clearAdminCache', async () => {
    const { service, getChatMember } = setup();
    getChatMember.mockResolvedValue({ status: 'administrator' } as never);

    await service.isShopAdmin(1);
    service.clearAdminCache();
    await service.isShopAdmin(1);

    expect(getChatMember).toHaveBeenCalledTimes(2);
  });

  it('starts over at 5000 entries', async () => {
    const { service, getChatMember } = setup();
    getChatMember.mockResolvedValue({ status: 'member' } as never);

    for (let id = 1; id <= 5001; id++) await service.isShopAdmin(id);
    getChatMember.mockClear();

    await service.isShopAdmin(5001);
    expect(getChatMember).not.toHaveBeenCalled();
    await service.isShopAdmin(1);
    expect(getChatMember).toHaveBeenCalledTimes(1);
  });
});

describe('MerchBotService.shopConfig', () => {
  const row = (monoJarUrl: string) =>
    ({ id: 1, monoJarUrl, adminChatId: null }) as MerchConfig;

  it('reads the row once', async () => {
    const { service, prisma } = build({});
    prisma.merchConfig.findUniqueOrThrow.mockResolvedValue(row('https://a'));

    expect(await service.shopConfig()).toEqual(row('https://a'));
    await service.shopConfig();

    expect(prisma.merchConfig.findUniqueOrThrow).toHaveBeenCalledTimes(1);
    expect(prisma.merchConfig.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });

  it('replaces the cached row on update', async () => {
    const { service, prisma } = build({});
    prisma.merchConfig.findUniqueOrThrow.mockResolvedValue(row('https://a'));
    prisma.merchConfig.update.mockResolvedValue(row('https://b'));

    await service.shopConfig();
    await service.updateShopConfig({ monoJarUrl: 'https://b' });

    expect((await service.shopConfig()).monoJarUrl).toBe('https://b');
    expect(prisma.merchConfig.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { monoJarUrl: 'https://b' },
    });
  });

  it('keeps an update that finished during a read', async () => {
    const { service, prisma } = build({});
    let finishRead: (value: MerchConfig) => void = () => {};
    prisma.merchConfig.findUniqueOrThrow.mockReturnValue(
      new Promise((resolve) => (finishRead = resolve)),
    );
    prisma.merchConfig.update.mockResolvedValue(row('https://new'));

    const reading = service.shopConfig();
    await service.updateShopConfig({ monoJarUrl: 'https://new' });
    finishRead(row('https://old'));

    expect((await reading).monoJarUrl).toBe('https://new');
    expect((await service.shopConfig()).monoJarUrl).toBe('https://new');
  });
});

describe('MerchBotService small parts', () => {
  it('builds an https app URL only', () => {
    const url = (env: Record<string, string>) =>
      build(env).service.appUrl('/5');

    expect(url({ PUBLIC_WEB_URL: 'https://example.test' })).toBe(
      'https://example.test/merch-app/5',
    );
    expect(url({ PUBLIC_WEB_URL: ' https://example.test/ ' })).toBe(
      'https://example.test/merch-app/5',
    );
    expect(url({ PUBLIC_WEB_URL: 'http://localhost:3000' })).toBeUndefined();
    expect(url({})).toBeUndefined();
  });

  it('caps every Telegram call and reaches a fake only through the env', () => {
    // grammY keeps these private and exposes nothing else to check them by.
    const client = (env: Record<string, string>) =>
      (build(env).service.telegram as unknown as { clientConfig: object })
        .clientConfig;

    expect(client({ MERCH_BOT_TOKEN: TOKEN })).toEqual({ timeoutSeconds: 60 });
    expect(
      client({
        MERCH_BOT_TOKEN: TOKEN,
        MERCH_BOT_API_ROOT: ' http://127.0.0.1:8081 ',
      }),
    ).toEqual({ timeoutSeconds: 60, apiRoot: 'http://127.0.0.1:8081' });
  });

  it('passes kick on to whoever set it', () => {
    const { service } = build({});
    const fn = jest.fn();

    service.setKick(fn);
    service.kick();

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
