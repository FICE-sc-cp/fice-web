import type { Response } from 'express';

export function sendXlsx(res: Response, buffer: Buffer, filename: string) {
  res.set({
    'Content-Type':
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': buffer.length.toString(),
    'Cache-Control': 'no-store',
  });
  res.send(buffer);
}
