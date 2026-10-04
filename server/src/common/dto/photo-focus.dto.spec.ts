import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDepartmentHeadDto } from '../../modules/department_head/dto/create-department-head.dto';
import { UpdateDepartmentHeadDto } from '../../modules/department_head/dto/update-department-head.dto';
import { CreateDepartmentMemberDto } from '../../modules/department_member/dto/create-department-member.dto';
import { UpdateDepartmentMemberDto } from '../../modules/department_member/dto/update-department-member.dto';

const invalid = async (cls: new () => object, body: object) =>
  (await validate(plainToInstance(cls, body))).map((e) => e.property).sort();

describe('photo focus fields', () => {
  const head = { firstName: 'Олена', lastName: 'Коваль' };
  const member = { ...head, role: 'DEPUTY' };

  it.each([
    [CreateDepartmentHeadDto, head],
    [CreateDepartmentMemberDto, member],
  ])('accepts a focus point and a zoom on %p', async (cls, base) => {
    await expect(
      invalid(cls, { ...base, photoFocusX: 0, photoFocusY: 100, photoZoom: 250 }),
    ).resolves.toEqual([]);
  });

  it.each([UpdateDepartmentHeadDto, UpdateDepartmentMemberDto])(
    'rejects values outside the frame on %p',
    async (cls) => {
      await expect(
        invalid(cls, { photoFocusX: -1, photoFocusY: 101, photoZoom: 99 }),
      ).resolves.toEqual(['photoFocusX', 'photoFocusY', 'photoZoom']);
      await expect(
        invalid(cls, { photoFocusX: 10.5, photoZoom: 301 }),
      ).resolves.toEqual(['photoFocusX', 'photoZoom']);
    },
  );
});
