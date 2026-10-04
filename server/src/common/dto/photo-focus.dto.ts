import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const PHOTO_ZOOM_MIN = 100;
export const PHOTO_ZOOM_MAX = 300;

export class PhotoFocusDto {
  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100,
    default: 50,
    description: 'Горизонтальна точка фокусу фото, % від лівого краю',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  photoFocusX?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100,
    default: 50,
    description: 'Вертикальна точка фокусу фото, % від верхнього краю',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  photoFocusY?: number;

  @ApiPropertyOptional({
    minimum: PHOTO_ZOOM_MIN,
    maximum: PHOTO_ZOOM_MAX,
    default: PHOTO_ZOOM_MIN,
    description: 'Масштаб фото в рамці, %',
  })
  @IsOptional()
  @IsInt()
  @Min(PHOTO_ZOOM_MIN)
  @Max(PHOTO_ZOOM_MAX)
  photoZoom?: number;
}
