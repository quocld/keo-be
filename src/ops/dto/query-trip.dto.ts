import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TripStatusEnum } from '../domain/trip-status.enum';

export class QueryTripDto {
  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 10))
  @IsNumber()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ enum: TripStatusEnum })
  @IsOptional()
  @IsEnum(TripStatusEnum)
  status?: TripStatusEnum;

  @ApiPropertyOptional({ description: 'Admin only' })
  @IsOptional()
  @IsUUID()
  harvestAreaId?: string;

  @ApiPropertyOptional({ description: 'Admin only' })
  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined && value !== '' ? Number(value) : undefined,
  )
  @IsNumber()
  driverId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  createdAtFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  createdAtTo?: string;
}
