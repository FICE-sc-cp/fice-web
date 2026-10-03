import { existsSync } from 'fs';
import { OWN_IMAGE_URL, ownUploadExists } from './own-upload';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(() => true),
}));

const ID = '0e352379-dbd8-407f-98a5-38d60ab53528';

describe('ownUploadExists', () => {
  it('accepts our upload URLs that exist on disk', () => {
    expect(ownUploadExists(`/uploads/${ID}.jpg`)).toBe(true);
    expect(ownUploadExists(`/uploads/${ID}.pdf`)).toBe(true);
  });

  it('rejects external URLs and anything outside the uploads naming scheme', () => {
    for (const url of [
      `https://evil.example/${ID}.jpg`,
      `/uploads/../../etc/passwd`,
      `/uploads/${ID}.svg`,
      `/uploads/not-a-uuid.jpg`,
      `/uploads/${ID}.jpg?x=1`,
    ]) {
      expect(ownUploadExists(url)).toBe(false);
    }
  });

  it('rejects PDFs where only images are allowed', () => {
    expect(ownUploadExists(`/uploads/${ID}.pdf`, OWN_IMAGE_URL)).toBe(false);
  });

  it('rejects a well-formed URL whose file does not exist', () => {
    (existsSync as jest.Mock).mockReturnValueOnce(false);
    expect(ownUploadExists(`/uploads/${ID}.png`)).toBe(false);
  });
});
