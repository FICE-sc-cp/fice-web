import {
  applyDecorators,
  NotFoundException,
  PipeTransform,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  NotContains,
  ValidateNested,
  ValidationOptions,
} from 'class-validator';
import { OWN_IMAGE_URL } from '../../upload/own-upload';
import { MAX_QTY } from './merch-rules';

/** Ids in URLs: anything that is not a sane positive int is a plain 404. */
export class MerchIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    if (!/^[1-9]\d{0,8}$/.test(value)) {
      throw new NotFoundException('Не знайдено');
    }
    return Number(value);
  }
}

export class MerchKindPipe implements PipeTransform<
  string,
  'category' | 'tag'
> {
  transform(value: string) {
    if (value !== 'category' && value !== 'tag') {
      throw new NotFoundException('Не знайдено');
    }
    return value;
  }
}

export const MONEY = /^\d{1,8}(\.\d{1,2})?$/;

const MAX_INT4 = 2_147_483_647;

/** Prisma throws on a number outside int4, which would be a 500 on a public route. */
const IsRowId = (options?: ValidationOptions) =>
  applyDecorators(IsInt(options), Min(1, options), Max(MAX_INT4, options));

/** Postgres refuses NUL in text, which would be a 500 with the bytes in the log. */
const IsText = (max: number, options?: ValidationOptions) =>
  applyDecorators(
    IsString(options),
    MaxLength(max, options),
    NotContains('\0', {
      ...options,
      message: 'Текст містить недопустимий символ.',
    }),
  );

/** IsObject: ValidateNested walks into an inner array, so `[[{...}]]` would pass. */
const EachNested = (type: () => new () => object) =>
  applyDecorators(
    IsObject({ each: true }),
    ValidateNested({ each: true }),
    Type(type),
  );

// ---- Customer ---------------------------------------------------------------

export class CartLineDto {
  @IsRowId()
  variantId: number;

  @IsInt()
  @Min(1)
  @Max(MAX_QTY)
  quantity: number;
}

export class CartDto {
  @IsArray()
  @ArrayMaxSize(50)
  @EachNested(() => CartLineDto)
  lines: CartLineDto[];
}

export class OrderLineDto extends CartLineDto {
  // What the customer saw. Shown to admins only if the variant is gone by submit.
  @IsText(300)
  label: string;
}

export class CreateOrderDto {
  @IsUUID()
  clientKey: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Кошик порожній.' })
  @ArrayMaxSize(50)
  @EachNested(() => OrderLineDto)
  lines: OrderLineDto[];

  @Matches(MONEY)
  expectedTotal: string;

  @IsIn(['NOVA_POSHTA', 'DAYF', 'LATER_CAMPUS'], {
    message: 'Оберіть спосіб доставки.',
  })
  delivery: 'NOVA_POSHTA' | 'DAYF' | 'LATER_CAMPUS';

  @IsOptional()
  @IsText(500)
  address?: string;

  @IsOptional()
  @IsRowId()
  recipientId?: number;

  @IsOptional()
  @IsText(255)
  recipientName?: string;

  @IsOptional()
  @IsText(50)
  recipientPhone?: string;

  @IsOptional()
  @IsBoolean()
  saveRecipient?: boolean;

  @Matches(OWN_IMAGE_URL, { message: 'Завантажте скріншот квитанції.' })
  receiptUrl: string;
}

export class RecipientDto {
  @IsText(255)
  @IsNotEmpty()
  fullName: string;

  @IsText(50)
  phone: string;
}

export class PickupDto {
  @IsOptional()
  @IsRowId()
  pickupSlotId?: number | null;

  @IsBoolean()
  needsIndividualPickup: boolean;
}

// ---- Admin ------------------------------------------------------------------

export class VariantDto {
  @IsText(20)
  @IsNotEmpty()
  size: string;

  @IsText(30)
  color: string; // '' for none

  @Matches(MONEY)
  price: string;

  @IsInt()
  @Min(0)
  @Max(MAX_INT4)
  order: number; // sizeIndex * 100 + colorIndex

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock?: number | null; // wanted; null is «Без обмежень»

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_INT4)
  stockSeen?: number | null; // what the form loaded; absent on new cells
}

export class PhotoDto {
  @IsText(30)
  color: string;

  @Matches(OWN_IMAGE_URL)
  url: string;

  @Matches(OWN_IMAGE_URL)
  thumbUrl: string;
}

export class ProductDto {
  @IsUUID()
  saveKey: string; // new for each distinct save, so a retry is recognised

  @IsOptional()
  @IsUUID()
  seenKey?: string | null; // the product's saveKey when the form loaded

  @IsText(255)
  @IsNotEmpty()
  title: string;

  @IsText(10_000) // the old shop had no limit
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsRowId()
  categoryId?: number | null;

  @IsArray()
  @ArrayMaxSize(50)
  @IsRowId({ each: true })
  tagIds: number[];

  @IsArray()
  @ArrayMaxSize(50)
  @IsRowId({ each: true })
  groupIds: number[];

  @IsArray()
  @ArrayMinSize(1, { message: 'Додайте хоча б один варіант' })
  @ArrayMaxSize(300)
  @EachNested(() => VariantDto)
  variants: VariantDto[];

  @IsArray()
  @ArrayMaxSize(50)
  @EachNested(() => PhotoDto)
  photos: PhotoDto[];
}

export class ActiveDto {
  @IsBoolean()
  isActive: boolean;
}

export class TemplatePriceDto {
  @IsText(20)
  size: string;

  @IsText(30)
  color: string;

  @Matches(MONEY)
  price: string;
}

export class TemplateDto {
  @IsText(100)
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsRowId()
  categoryId?: number | null;

  @IsText(5000)
  description: string;

  @IsArray()
  @ArrayMaxSize(50)
  @IsRowId({ each: true })
  tagIds: number[];

  @IsArray()
  @ArrayMaxSize(50)
  @IsRowId({ each: true })
  groupIds: number[];

  @IsArray()
  @ArrayMaxSize(30)
  @IsText(20, { each: true })
  sizes: string[];

  @IsArray()
  @ArrayMaxSize(50)
  @IsText(30, { each: true })
  colors: string[];

  @IsArray()
  @ArrayMaxSize(300)
  @EachNested(() => TemplatePriceDto)
  prices: TemplatePriceDto[];
}

export class LabelDto {
  @IsText(50)
  @IsNotEmpty()
  name: string;
}

export class GroupDto {
  @IsText(255)
  @IsNotEmpty({ message: 'Вкажіть назву групи.' })
  name: string;
}

export class IdsDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @IsRowId({ each: true })
  ids: number[];
}

export class MembersDto {
  @IsText(5000)
  values: string;
}

export class SlotDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @Matches(/^\d{2}:\d{2}$/)
  startTime: string;

  @Matches(/^\d{2}:\d{2}$/)
  endTime: string;
}
