import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDepartmentDto } from './create-department.dto';
import { UpdateDepartmentDto } from './update-department.dto';

const check = async (telegramChatId: unknown) => {
  const dto = plainToInstance(CreateDepartmentDto, {
    name: 'Департамент',
    telegramChatId,
  });
  const errors = await validate(dto);
  return {
    value: dto.telegramChatId,
    errors: errors.flatMap((e) => Object.values(e.constraints ?? {})),
  };
};

describe('CreateDepartmentDto.telegramChatId', () => {
  it('accepts a group id and cleans up spaces', async () => {
    await expect(check(' -1003994384697 ')).resolves.toEqual({
      value: '-1003994384697',
      errors: [],
    });
  });

  it('accepts a group id with one topic', async () => {
    await expect(check('-1003994384697 / 12')).resolves.toEqual({
      value: '-1003994384697/12',
      errors: [],
    });
  });

  it('treats an empty value as not set', async () => {
    await expect(check('   ')).resolves.toEqual({ value: null, errors: [] });
    await expect(check(null)).resolves.toEqual({ value: null, errors: [] });
  });

  it.each([
    '1003994384697',
    '@fice_group',
    'https://t.me/c/3994384697/5',
    '-100abc',
  ])('rejects %s with a message shown under the field', async (bad) => {
    const { errors } = await check(bad);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^telegramChatId Вкажи числовий ID групи/);
  });
});

describe('UpdateDepartmentDto.telegramChatId', () => {
  it('cleans up and validates the chat id like the create form', async () => {
    const ok = plainToInstance(UpdateDepartmentDto, {
      telegramChatId: ' -1003994384697 ',
    });
    expect(ok.telegramChatId).toBe('-1003994384697');
    await expect(validate(ok)).resolves.toHaveLength(0);
    const bad = plainToInstance(UpdateDepartmentDto, {
      telegramChatId: '1003994384697',
    });
    const errors = (await validate(bad)).flatMap((e) =>
      Object.values(e.constraints ?? {}),
    );
    expect(errors[0]).toMatch(/^telegramChatId Вкажи числовий ID групи/);
  });
});
