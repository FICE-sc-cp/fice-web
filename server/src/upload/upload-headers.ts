import { extname } from 'path';

type HeaderSink = { setHeader(name: string, value: string): unknown };

export const SANDBOX_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; sandbox";
export const PDF_CSP = "default-src 'none'";

const DOWNLOADS = new Set(['.pdf', '.doc', '.docx']);

export function setUploadHeaders(res: HeaderSink, filePath: string): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  if (DOWNLOADS.has(extname(filePath).toLowerCase())) {
    res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('Content-Security-Policy', PDF_CSP);
    return;
  }
  res.setHeader('Content-Security-Policy', SANDBOX_CSP);
}
