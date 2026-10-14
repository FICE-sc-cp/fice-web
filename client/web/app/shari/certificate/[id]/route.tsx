import { readFile } from 'fs/promises';
import { join } from 'path';
import { ImageResponse } from 'next/og';
import { ApiError, request } from '@/lib/api';
import type { Certificate } from '@/lib/shari';

// The council's template (a 10×7.5in slide) at 160 dpi: the slide's text box
// with Arial 21pt and 115% line spacing, here Liberation Sans (same metrics).
// Rendered on the server with bundled fonts (satori + resvg, WebAssembly, so it
// doesn't depend on the CPU), so every certificate looks exactly the same.
const WIDTH = 1600;
const HEIGHT = 1200;
const PX_PER_PT = 160 / 72;
const TEXT = { left: 187, top: 428, width: 900, height: 700 };
const LINE = 1.32;
const QR = { left: 1200, top: 780, size: 280, pad: 16 };
const FONT = 'Liberation Sans';

type Assets = { regular: Buffer; bold: Buffer; background: string };
let assets: Promise<Assets> | undefined;

/** Fonts and the 16-colour template background (it keeps the PNG small), read once. */
function loadAssets(): Promise<Assets> {
  const file = (name: string) => readFile(join(process.cwd(), 'assets', 'shari', name));
  return (assets ??= Promise.all([
    file('LiberationSans-Regular.ttf'),
    file('LiberationSans-Bold.ttf'),
    file('background.png'),
  ]).then(([regular, bold, background]) => ({
    regular,
    bold,
    background: `data:image/png;base64,${background.toString('base64')}`,
  })));
}

/**
 * The template's 21pt, or smaller until the text fits the box.
 * ponytail: satori can't measure text, so lines are estimated from an average
 * glyph width (generous for bold Cyrillic); a box can end up a line short of full.
 */
function fontSize(c: Certificate): number {
  const lines = (text: string, px: number, em: number) =>
    Math.max(1, Math.ceil((text.length * em * px) / (TEXT.width * 0.92)));
  for (let pt = 21; pt > 12; pt--) {
    const px = pt * PX_PER_PT;
    const count =
      5 +
      lines(c.studentName, px, 0.58) +
      lines(c.discipline, px, 0.58) +
      lines(c.bonus, px, 0.58) +
      (c.condition ? lines(`Умова: ${c.condition}`, px, 0.53) : 0) +
      lines(c.teacher, px, 0.58);
    if (count * px * LINE <= TEXT.height) return px;
  }
  return 12 * PX_PER_PT;
}

/** The certificate of one award, for its group's starosta or the presidium (the API checks). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const login = req.headers.get('x-telegram-login');
  let c: Certificate;
  try {
    // The search part carries the dev identity the API accepts only with AUTH_DISABLED.
    c = await request<Certificate>(
      `/shari/awards/${encodeURIComponent(id)}/certificate${new URL(req.url).search}`,
      { headers: login ? { 'x-telegram-login': login } : {} },
    );
  } catch (err) {
    return Response.json(
      { message: err instanceof Error ? err.message : 'Не вдалося отримати шару' },
      { status: err instanceof ApiError ? err.status : 502 },
    );
  }

  const { regular, bold, background } = await loadAssets();
  const px = fontSize(c);
  const value = { fontWeight: 700 } as const;

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: 'flex',
          position: 'relative',
          fontFamily: FONT,
          color: '#000',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={background} width={WIDTH} height={HEIGHT} style={{ position: 'absolute', left: 0, top: 0 }} />
        <div
          style={{
            position: 'absolute',
            left: TEXT.left,
            top: TEXT.top,
            width: TEXT.width,
            display: 'flex',
            flexDirection: 'column',
            fontSize: px,
            lineHeight: LINE,
          }}
        >
          <span>ПІБ студента:</span>
          <span style={value}>{c.studentName}</span>
          <div style={{ display: 'flex' }}>
            <span style={{ marginRight: px * 0.28 }}>Група:</span>
            <span style={value}>{c.group}</span>
          </div>
          <span>Предмет:</span>
          <span style={value}>{c.discipline}</span>
          <span>Бонус:</span>
          <span style={value}>{c.bonus}</span>
          {c.condition && <span>{`Умова: ${c.condition}`}</span>}
          <span>Викладач:</span>
          <span style={value}>{c.teacher}</span>
        </div>
        {/* White card under the QR, so the watermark doesn't confuse scanners. */}
        <div
          style={{
            position: 'absolute',
            left: QR.left - QR.pad,
            top: QR.top - QR.pad,
            width: QR.size + QR.pad * 2,
            padding: QR.pad,
            paddingBottom: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: '#fff',
            borderRadius: 20,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={c.qr} width={QR.size} height={QR.size} />
          <span style={{ marginTop: 6, fontSize: 11 * PX_PER_PT }}>Перевірити шару</span>
          {/* Teachers check the address: a fake QR can lead to a copy of the page. */}
          <span style={{ fontSize: 9 * PX_PER_PT, fontWeight: 700 }}>{new URL(c.checkUrl).host}</span>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: FONT, data: regular, weight: 400, style: 'normal' },
        { name: FONT, data: bold, weight: 700, style: 'normal' },
      ],
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
