import { MerchSheetService } from './merch-sheet.service';

const ID = 'sheet-1';
const STAMP = { _count: 1, _max: { updatedAt: new Date(1_000) } };
const FIVE_MINUTES = 5 * 60_000;

const order = {
  id: 7,
  status: 'CANCELLED',
  totalAmount: { toFixed: () => '500.00' },
  recipientName: 'Тарас Шевченко',
  phone: '+380991234567',
  deliveryMethod: 'NOVA_POSHTA',
  address: 'Київ, відділення 1',
  statusBy: 'Леся Українка',
  items: [{ title: 'Футболка', size: 'M', color: '', quantity: 2 }],
};

const reply = (body: unknown = {}, status = 200) => ({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve('denied'),
});

function build(
  env: Record<string, string> = { GOOGLE_MERCH_SPREADSHEET_ID: ID },
) {
  const prisma = {
    merchOrder: {
      aggregate: jest.fn().mockResolvedValue(STAMP),
      findMany: jest.fn().mockResolvedValue([order]),
    },
  };
  const google = { getAccessToken: jest.fn().mockResolvedValue('token') };
  const service = new MerchSheetService(
    prisma as never,
    google as never,
    { get: (key: string) => env[key] } as never,
  );
  return { service, prisma, google };
}

describe('MerchSheetService', () => {
  type Init = { method: string; body?: string };
  type Reply = ReturnType<typeof reply>;

  const realFetch = global.fetch;
  let fetchMock: jest.Mock<Promise<Reply>, [string, Init]>;

  const url = (call: number) => fetchMock.mock.calls[call][0];
  const init = (call: number) => fetchMock.mock.calls[call][1];
  const written = (call: number) =>
    (JSON.parse(init(call).body!) as { values: string[][] }).values;

  beforeEach(() => {
    fetchMock = jest.fn<Promise<Reply>, [string, Init]>((target) =>
      Promise.resolve(
        reply(
          target.includes('?fields=')
            ? { sheets: [{ properties: { title: 'Замовлення' } }] }
            : {},
        ),
      ),
    );
    global.fetch = fetchMock as never;
  });

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('runs no timer and makes no Google call without a spreadsheet id', () => {
    const setTimer = jest.spyOn(global, 'setInterval');
    const { service, google } = build({});

    service.onModuleInit();

    expect(setTimer).not.toHaveBeenCalled();
    expect(google.getAccessToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ticks every 30 s on an unreferenced timer that stops with the module', () => {
    const handle = { unref: jest.fn() };
    const setTimer = jest
      .spyOn(global, 'setInterval')
      .mockReturnValue(handle as never);
    const clear = jest.spyOn(global, 'clearInterval');
    const { service } = build();

    service.onModuleInit();
    service.onModuleDestroy();

    expect(setTimer).toHaveBeenCalledWith(expect.any(Function), 30_000);
    expect(handle.unref).toHaveBeenCalled();
    expect(clear).toHaveBeenCalledWith(handle);
  });

  it('writes RAW over the first tab and clears the tail below the table', async () => {
    const { service } = build();

    await service.tick();

    expect(url(0)).toContain(`/${ID}?fields=sheets.properties.title`);
    const quoted = encodeURIComponent("'Замовлення'");
    expect(url(1)).toContain(`/values/${quoted}!A1?valueInputOption=RAW`);
    expect(init(1).method).toBe('PUT');
    const table = written(1);
    expect(table).toHaveLength(2);
    expect(table[0][0]).toBe('№');
    // Column H stays empty on a cancelled order.
    expect(table[1]).toEqual([
      '7',
      'Скасовано',
      '500.00',
      'Тарас Шевченко',
      '+380991234567',
      'Нова Пошта Київ, відділення 1',
      'Футболка M x2',
      '',
    ]);
    expect(url(2)).toContain(`/values/${quoted}!A3:H:clear`);
    expect(init(2).method).toBe('POST');
  });

  it('empties the sheet down to the header after /clear_orders', async () => {
    const { service, prisma } = build();
    await service.tick();
    fetchMock.mockClear();
    prisma.merchOrder.aggregate.mockResolvedValue({
      _count: 0,
      _max: { updatedAt: null },
    });
    prisma.merchOrder.findMany.mockResolvedValue([]);

    await service.tick();

    expect(written(0)).toHaveLength(1);
    expect(url(1)).toContain('!A2:H:clear');
  });

  it('makes one cheap query and no Google call while nothing changed', async () => {
    const { service, prisma, google } = build();
    await service.tick();
    fetchMock.mockClear();
    google.getAccessToken.mockClear();
    prisma.merchOrder.findMany.mockClear();

    await service.tick();

    expect(prisma.merchOrder.aggregate).toHaveBeenCalledTimes(2);
    expect(prisma.merchOrder.findMany).not.toHaveBeenCalled();
    expect(google.getAccessToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rewrites on a changed order and reads the tab name only once', async () => {
    const { service, prisma } = build();
    await service.tick();
    prisma.merchOrder.aggregate.mockResolvedValue({
      _count: 1,
      _max: { updatedAt: new Date(2_000) },
    });
    fetchMock.mockClear();

    await service.tick();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(url(0)).toContain('valueInputOption=RAW');
  });

  it('doubles a quote in a tab name, as A1 notation wants', async () => {
    fetchMock.mockResolvedValueOnce(
      reply({ sheets: [{ properties: { title: "Мерч'26" } }] }),
    );
    const { service } = build();

    await service.tick();

    expect(url(1)).toContain(encodeURIComponent("'Мерч''26'"));
  });

  it('pauses 5 min after an error, then writes what it could not', async () => {
    const { service, prisma } = build();
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    await service.tick();
    prisma.merchOrder.aggregate.mockResolvedValue({
      _count: 2,
      _max: { updatedAt: new Date(2_000) },
    });
    fetchMock.mockResolvedValueOnce(reply({}, 403));

    await service.tick();
    fetchMock.mockClear();
    prisma.merchOrder.aggregate.mockClear();

    now.mockReturnValue(1_000_000 + FIVE_MINUTES - 1);
    await service.tick();
    expect(prisma.merchOrder.aggregate).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    now.mockReturnValue(1_000_000 + FIVE_MINUTES);
    await service.tick();
    expect(fetchMock).toHaveBeenCalledTimes(3); // the tab, the rows, the tail
  });

  it('reads the first tab again after an error, so a renamed tab heals', async () => {
    const { service, prisma } = build();
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    await service.tick();
    prisma.merchOrder.aggregate.mockResolvedValue({
      _count: 2,
      _max: { updatedAt: new Date(2_000) },
    });
    fetchMock.mockResolvedValueOnce(reply({}, 400));
    await service.tick();
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(
      reply({ sheets: [{ properties: { title: 'Замовлення' } }] }),
    );

    now.mockReturnValue(1_000_000 + FIVE_MINUTES);
    await service.tick();

    expect(String(fetchMock.mock.calls[0][0])).toContain('?fields=sheets');
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      encodeURIComponent("'Замовлення'"),
    );
  });

  it('survives missing Google credentials', async () => {
    const { service, google } = build();
    google.getAccessToken.mockRejectedValue(new Error('no credentials'));

    await expect(service.tick()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
