import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  Allow,
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Min,
  Validate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { HasAtLeastOneReceiptImageConstraint } from './validators/has-at-least-one-receipt-image.validator';

export class SubmitReceiptDto {
  @ApiHideProperty()
  @Validate(HasAtLeastOneReceiptImageConstraint)
  @Allow()
  _receiptImageRule?: unknown;

  @ApiPropertyOptional({ description: 'Optional: receipt belongs to a trip' })
  @IsOptional()
  @IsUUID()
  tripId?: string;

  @ApiPropertyOptional({
    description:
      'Required when submitting as **owner**: id of the managed driver this receipt belongs to. Omit when the caller is a driver.',
    example: 42,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  driverUserId?: number;

  @ApiProperty({ example: 'a7c2f2d0-7c2e-4e44-9fd0-1d9f1b8b7a11' })
  @IsUUID()
  harvestAreaId: string;

  @ApiPropertyOptional({
    example: 'b6e3b4b5-2c0f-4a9f-a8e8-4b2a9c1c7b2c',
    description:
      'Optional. If tripId is set, server uses the trip weighing station (must match if you send this field).',
  })
  @IsOptional()
  @IsUUID()
  weighingStationId?: string;

  @ApiProperty({ example: 120.5 })
  @IsNumber()
  @Min(0.000001)
  @Type(() => Number)
  weight: number;

  @ApiProperty({ example: 250000 })
  @IsNumber()
  @Type(() => Number)
  amount: number;

  @ApiProperty({ example: '2026-03-27T10:00:00.000Z' })
  @IsDateString()
  receiptDate: string;

  @ApiPropertyOptional({ example: 'BILL-2026-0001' })
  @IsOptional()
  @IsString()
  billCode?: string;

  @ApiPropertyOptional({ example: 'Ghi chú...' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Public image URLs (optional if imageFileIds provided).',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUrl({ require_tld: false }, { each: true })
  imageUrls?: string[];

  @ApiPropertyOptional({
    description:
      'File IDs from POST /v1/files/upload (after upload completes).',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  imageFileIds?: string[];

  @ApiPropertyOptional({
    deprecated: true,
    description: 'Use imageUrls instead.',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  receiptImageUrl?: string;
}
