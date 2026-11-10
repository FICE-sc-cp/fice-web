import { existsSync } from 'fs';
import {
  OWN_IMAGE_URL,
  ownUploadExists,
  ownUploadUrl,
  uploadFilenames,
} from './own-upload';

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

describe('ownUploadUrl', () => {
  it('matches our uploads with the given extensions only', () => {
    const pattern = ownUploadUrl(['.mp4', '.mov']);
    expect(pattern.test(`/uploads/${ID}.mov`)).toBe(true);
    expect(pattern.test(`/uploads/${ID}.mp4`)).toBe(true);
    expect(pattern.test(`/uploads/${ID}.jpg`)).toBe(false);
    expect(pattern.test(`/uploads/${ID}.mov.html`)).toBe(false);
    expect(pattern.test(`/uploads/x/${ID}.mov`)).toBe(false);
  });
});

describe('uploadFilenames', () => {
  it('finds each upload once, inside plain links and file answers', () => {
    const other = '1e352379-dbd8-407f-98a5-38d60ab53528';
    expect(
      uploadFilenames([
        `/uploads/${ID}.jpg`,
        null,
        'Так',
        JSON.stringify([
          { url: `/uploads/${other}.docx`, name: 'a' },
          { url: `/uploads/${ID}.jpg`, name: 'b' },
        ]),
        '/uploads/not-a-uuid.jpg',
      ]),
    ).toEqual([`${ID}.jpg`, `${other}.docx`]);
  });
});
