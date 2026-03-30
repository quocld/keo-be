import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, ValidateIf } from 'class-validator';

export type AnalyticsRangeEnum = 'today' | 'month' | 'custom';

export class AnalyticsRangeQueryDto {
  @ApiPropertyOptional({
    example: 'today',
    enum: ['today', 'month', 'custom'],
  })
  @IsOptional()
  @IsIn(['today', 'month', 'custom'])
  range?: AnalyticsRangeEnum;

  @ApiPropertyOptional({ example: '2026-03-01T00:00:00.000Z' })
  @ValidateIf((o) => o.range === 'custom')
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-03-31T23:59:59.999Z' })
  @ValidateIf((o) => o.range === 'custom')
  @IsDateString()
  to?: string;
}
