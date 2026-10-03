import { extname } from 'path';

type HeaderSink = { setHeader(name: string, value: string): unknown };

export const SANDBOX_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; sandbox";
export const PDF_CSP = "default-src 'none'";

export function setUploadHeaders(res: HeaderSink, filePath: string): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  if (extname(filePath).toLowerCase() === '.pdf') {
    res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('Content-Security-Policy', PDF_CSP);
    return;
  }
  res.setHeader('Content-Security-Policy', SANDBOX_CSP);
}
