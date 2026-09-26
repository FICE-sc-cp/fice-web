import {
  MonobankJarClient,
  parseJarResponse,
  parseJarWidget,
} from './monobank-jar.client';

const WIDGET_ID = '3nzmmsWPvF88kT6FKrnpUwSaLkF2pwMK';

describe('parseJarWidget', () => {
  it('reads the widget id and sendId from a widget link', () => {
    expect(
      parseJarWidget(
        ` https://send.monobank.ua/widget.html?jar=${WIDGET_ID}&sendId=6MJtUJ8B8d&type=qrp&colorScheme=black `,
      ),
    ).toEqual({ widgetId: WIDGET_ID, sendId: '6MJtUJ8B8d' });
  });

  it('works without sendId', () => {
    expect(
      parseJarWidget(`https://send.monobank.ua/widget.html?jar=${WIDGET_ID}`),
    ).toEqual({ widgetId: WIDGET_ID, sendId: null });
  });

  it.each([
    ['empty', ''],
    ['null', null],
    ['not a url', 'hello'],
    ['public jar link', 'https://send.monobank.ua/jar/6MJtUJ8B8d'],
    ['http', `http://send.monobank.ua/widget.html?jar=${WIDGET_ID}`],
    ['foreign host', `https://evil.com/widget.html?jar=${WIDGET_ID}`],
    ['lookalike host', `https://notmonobank.ua/widget.html?jar=${WIDGET_ID}`],
    ['short id', 'https://send.monobank.ua/widget.html?jar=6MJtUJ8B8d'],
    [
      'bad chars',
      'https://send.monobank.ua/widget.html?jar=../../../../etc/passwd1',
    ],
  ])('rejects %s', (_, link) => {
    expect(parseJarWidget(link)).toBeNull();
  });
});

describe('parseJarResponse', () => {
  const body = {
    amount: 123456,
    goal: 5000000,
    currency: 980,
    jarId: '6MJtUJ8B8d',
    closed: false,
    ownerName: 'Ім’я',
  };

  it('keeps only the fields we need', () => {
    expect(parseJarResponse(body)).toEqual({
      kind: 'ok',
      jar: {
        amountKopecks: 123456,
        goalKopecks: 5000000,
        closed: false,
        sendId: '6MJtUJ8B8d',
      },
    });
  });

  it('treats a missing goal as no goal', () => {
    expect(parseJarResponse({ ...body, goal: undefined })).toMatchObject({
      jar: { goalKopecks: 0 },
    });
  });

  it('reads the closed flag', () => {
    expect(parseJarResponse({ ...body, closed: true })).toMatchObject({
      jar: { closed: true },
    });
  });

  it('rejects non-UAH jars', () => {
    expect(parseJarResponse({ ...body, currency: 840 })).toMatchObject({
      kind: 'unsupported',
    });
  });

  it.each([
    ['missing amount', { ...body, amount: undefined }],
    ['string amount', { ...body, amount: '100' }],
    ['negative amount', { ...body, amount: -1 }],
    ['fractional amount', { ...body, amount: 10.5 }],
    ['huge amount', { ...body, amount: 1e20 }],
    ['bad goal', { ...body, goal: 'lots' }],
    ['array', []],
    ['null', null],
    ['string', 'ok'],
  ])('treats %s as a temporary failure', (_, value) => {
    expect(parseJarResponse(value)).toMatchObject({ kind: 'unavailable' });
  });

  it('ignores a malformed jarId', () => {
    expect(parseJarResponse({ ...body, jarId: '<script>' })).toMatchObject({
      jar: { sendId: null },
    });
  });
});

describe('MonobankJarClient', () => {
  let client: MonobankJarClient;
  let fetchMock: jest.SpyInstance;

  const reply = (status: number, text: string) =>
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(text, { status })),
    );

  beforeEach(() => {
    client = new MonobankJarClient();
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
    jest.useRealTimers();
  });

  describe('short reuse of fresh answers', () => {
    const okBody = JSON.stringify({ amount: 100, goal: 0, currency: 980 });

    it('always asks Monobank when no reuse window is given', async () => {
      reply(200, okBody);
      await client.fetch(WIDGET_ID);
      await client.fetch(WIDGET_ID);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('reuses a successful answer inside the window', async () => {
      reply(200, okBody);
      await client.fetch(WIDGET_ID);
      await expect(client.fetch(WIDGET_ID, 60_000)).resolves.toMatchObject({
        kind: 'ok',
        jar: { amountKopecks: 100 },
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('asks again once the window has passed', async () => {
      jest.useFakeTimers({ now: new Date('2026-09-25T12:00:00Z') });
      reply(200, okBody);
      await client.fetch(WIDGET_ID);
      jest.setSystemTime(Date.now() + 61_000);
      await client.fetch(WIDGET_ID, 60_000);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('never reuses a failed answer', async () => {
      reply(429, '{"errCode":"TMR"}');
      await client.fetch(WIDGET_ID);
      await client.fetch(WIDGET_ID, 60_000);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('keeps answers per jar', async () => {
      reply(200, okBody);
      await client.fetch(WIDGET_ID);
      await client.fetch(`${WIDGET_ID}x`, 60_000);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it('posts an empty JSON body to the widget endpoint', async () => {
    reply(200, JSON.stringify({ amount: 100, goal: 0, currency: 980 }));
    await expect(client.fetch(WIDGET_ID)).resolves.toMatchObject({
      kind: 'ok',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.monobank.ua/bank/jar/${WIDGET_ID}`);
    expect(init).toMatchObject({ method: 'POST', body: '{}' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('maps 429 to rate-limited', async () => {
    reply(429, '{"errCode":"TMR","errText":"Too many requests"}');
    await expect(client.fetch(WIDGET_ID)).resolves.toEqual({
      kind: 'rate-limited',
    });
  });

  it('maps "invalid alias" to invalid', async () => {
    reply(400, '{"errCode":"DEFAULT_ERROR","errText":"invalid alias"}');
    await expect(client.fetch(WIDGET_ID)).resolves.toEqual({ kind: 'invalid' });
  });

  it('maps 404 to invalid', async () => {
    reply(404, '');
    await expect(client.fetch(WIDGET_ID)).resolves.toEqual({ kind: 'invalid' });
  });

  it.each([
    ['other 400', 400, '{"errText":"something else"}'],
    ['server error', 500, 'oops'],
    ['bad gateway', 502, '<html>'],
    ['HTML on 200', 200, '<html>maintenance</html>'],
    ['empty 200', 200, ''],
  ])('maps %s to unavailable', async (_, status, text) => {
    reply(status, text);
    await expect(client.fetch(WIDGET_ID)).resolves.toMatchObject({
      kind: 'unavailable',
    });
  });

  it('maps a network error to unavailable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(client.fetch(WIDGET_ID)).resolves.toEqual({
      kind: 'unavailable',
      reason: 'немає звʼязку з Monobank',
    });
  });

  it('maps a timeout to unavailable', async () => {
    fetchMock.mockRejectedValue(
      new DOMException(
        'The operation was aborted due to timeout',
        'TimeoutError',
      ),
    );
    await expect(client.fetch(WIDGET_ID)).resolves.toEqual({
      kind: 'unavailable',
      reason: 'Monobank не відповів за 10 секунд',
    });
  });
});
