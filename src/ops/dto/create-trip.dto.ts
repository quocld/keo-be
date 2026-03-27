import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTripDto {
  @ApiProperty()
  @IsUUID()
  harvestAreaId: string;

  @ApiProperty()
  @IsUUID()
  weighingStationId: string;

  @ApiPropertyOptional({ example: 42.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  estimatedDistance?: number;

  @ApiPropertyOptional({
    description:
      'If true, trip starts immediately (in_progress). Only one in_progress trip per driver.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  startNow?: boolean;
}
