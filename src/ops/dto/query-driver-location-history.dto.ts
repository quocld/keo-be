import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

/** Shared query for driver roaming location history (me + owner). */
export class QueryDriverLocationHistoryDto {
  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 1))
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @Transform(({ value }) => (value ? Number(value) : 50))
  @IsNumber()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  timestampFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  timestampTo?: string;
}
