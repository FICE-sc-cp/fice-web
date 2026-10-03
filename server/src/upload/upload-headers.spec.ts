import { PDF_CSP, SANDBOX_CSP, setUploadHeaders } from './upload-headers';

const headersFor = (filePath: string) => {
  const headers: Record<string, string> = {};
  setUploadHeaders(
    { setHeader: (name, value) => (headers[name] = value) },
    filePath,
  );
  return headers;
};

describe('setUploadHeaders', () => {
  it('keeps the sandbox CSP for images', () => {
    for (const file of ['/app/uploads/a.jpg', '/app/uploads/b.PNG', 'c.webp']) {
      const headers = headersFor(file);
      expect(headers['Content-Security-Policy']).toBe(SANDBOX_CSP);
      expect(headers['Content-Disposition']).toBeUndefined();
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
    }
  });

  it('serves PDFs as downloads without the sandbox directive', () => {
    const headers = headersFor('/app/uploads/receipt.PDF');
    expect(headers['Content-Disposition']).toBe('attachment');
    expect(headers['Content-Security-Policy']).toBe(PDF_CSP);
    expect(headers['Content-Security-Policy']).not.toContain('sandbox');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });
});
