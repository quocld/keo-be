import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { HarvestAreaStatusEnum } from '../domain/harvest-area-status.enum';

export class FilterHarvestAreaDto {
  @ApiPropertyOptional({ enum: HarvestAreaStatusEnum })
  @IsOptional()
  @IsEnum(HarvestAreaStatusEnum)
  status?: HarvestAreaStatusEnum | null;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  ownerId?: number | null;

  @ApiPropertyOptional({
    example: 'Khu A',
    description: 'Tìm kiếm theo tên khu (không phân biệt hoa/thường)',
  })
  @IsOptional()
  @IsString()
  name?: string | null;
}

export class QueryHarvestAreaDto {
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

  @ApiPropertyOptional({
    type: String,
    description: 'JSON string: {"status":"active","ownerId":2}',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value
      ? plainToInstance(FilterHarvestAreaDto, JSON.parse(value))
      : undefined,
  )
  @ValidateNested()
  @Type(() => FilterHarvestAreaDto)
  filters?: FilterHarvestAreaDto | null;
}
