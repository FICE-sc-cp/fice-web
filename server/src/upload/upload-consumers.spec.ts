import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { existsSync } from 'fs';
import { CreateEventRegistrationDto } from '../modules/event/dto/create-event-registration.dto';
import { CreateOrderDto, PhotoDto } from '../modules/merch/merch.dto';
import { SubmitCandidateDto } from '../modules/voting/dto/submit-candidate.dto';
import { OWN_IMAGE_URL, ownUploadExists } from './own-upload';

jest.mock('fs', () => ({
  ...jest.requireActual<typeof import('fs')>('fs'),
  existsSync: jest.fn(() => true),
}));

const ID = '0e352379-dbd8-407f-98a5-38d60ab53528';
const url = (ext: string) => `/uploads/${ID}.${ext}`;
const IMAGES = ['jpg', 'jpeg', 'png', 'webp'];
const ANSWER_ONLY = ['mp4', 'mov', 'webm', 'doc', 'docx'];

async function refuses(
  cls: new () => object,
  field: string,
  value: string,
): Promise<boolean> {
  const errors = await validate(plainToInstance(cls, { [field]: value }));
  return errors.some((error) => error.property === field);
}

describe('uploads other features accept', () => {
  it('keeps event receipts to photos and PDF', async () => {
    for (const ext of [...IMAGES, 'pdf']) {
      await expect(
        refuses(CreateEventRegistrationDto, 'receiptUrl', url(ext)),
      ).resolves.toBe(false);
      expect(ownUploadExists(url(ext))).toBe(true);
    }
    for (const ext of [...ANSWER_ONLY, 'gif', 'svg']) {
      await expect(
        refuses(CreateEventRegistrationDto, 'receiptUrl', url(ext)),
      ).resolves.toBe(true);
      expect(ownUploadExists(url(ext))).toBe(false);
    }
  });

  it.each([
    ['merch receipt', CreateOrderDto, 'receiptUrl'],
    ['merch photo', PhotoDto, 'url'],
    ['merch thumbnail', PhotoDto, 'thumbUrl'],
    ['costume photo', SubmitCandidateDto, 'photoUrl'],
  ] as const)('keeps the %s to images', async (_, cls, field) => {
    for (const ext of IMAGES) {
      await expect(refuses(cls, field, url(ext))).resolves.toBe(false);
      expect(ownUploadExists(url(ext), OWN_IMAGE_URL)).toBe(true);
    }
    for (const ext of ['pdf', ...ANSWER_ONLY]) {
      await expect(refuses(cls, field, url(ext))).resolves.toBe(true);
      expect(ownUploadExists(url(ext), OWN_IMAGE_URL)).toBe(false);
    }
    expect(existsSync).toHaveBeenCalled();
  });
});
