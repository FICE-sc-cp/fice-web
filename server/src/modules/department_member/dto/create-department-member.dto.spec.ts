import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDepartmentMemberDto } from './create-department-member.dto';
import { UpdateDepartmentMemberDto } from './update-department-member.dto';

const base = { role: 'DEPUTY', firstName: 'Юлія', lastName: 'Михайленко' };

const errorsOf = async (dto: object) =>
  (await validate(dto)).flatMap((e) => Object.keys(e.constraints ?? {}));

describe('CreateDepartmentMemberDto presidium profile', () => {
  it('accepts a title, a description and an order', async () => {
    const dto = plainToInstance(CreateDepartmentMemberDto, {
      ...base,
      title: '  Заступниця голови з внутрішньої роботи ',
      description: 'Опікується внутрішньою роботою.',
      order: 4,
    });
    expect(dto.title).toBe('Заступниця голови з внутрішньої роботи');
    await expect(errorsOf(dto)).resolves.toEqual([]);
  });

  it('clears empty texts so the role label is used again', async () => {
    const dto = plainToInstance(UpdateDepartmentMemberDto, {
      title: ' ',
      description: '',
    });
    expect(dto.title).toBeNull();
    expect(dto.description).toBeNull();
    await expect(errorsOf(dto)).resolves.toEqual([]);
  });

  it('rejects a too long title or description and a negative order', async () => {
    const dto = plainToInstance(CreateDepartmentMemberDto, {
      ...base,
      title: 'x'.repeat(101),
      description: 'x'.repeat(1001),
      order: -1,
    });
    await expect(errorsOf(dto)).resolves.toEqual(
      expect.arrayContaining(['maxLength', 'min']),
    );
    expect((await validate(dto)).map((e) => e.property).sort()).toEqual([
      'description',
      'order',
      'title',
    ]);
  });
});
