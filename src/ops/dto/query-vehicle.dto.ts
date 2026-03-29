import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';

export class FilterVehicleDto {
  @ApiPropertyOptional({ example: 'active' })
  @IsOptional()
  @IsString()
  status?: string | null;

  @ApiPropertyOptional({
    example: 2,
    description: 'Admin only: filter by fleet owner user id.',
  })
  @IsOptional()
  @IsNumber()
  ownerId?: number | null;
}

export class QueryVehicleDto {
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
    description:
      'JSON string: {"status":"active","ownerId":2} (ownerId: admin only)',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value ? plainToInstance(FilterVehicleDto, JSON.parse(value)) : undefined,
  )
  @ValidateNested()
  @Type(() => FilterVehicleDto)
  filters?: FilterVehicleDto | null;
}
