import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { AnalyticsRangeQueryDto } from './range-query.dto';

export type FinanceGroupByEnum =
  | 'day'
  | 'harvestArea'
  | 'weighingStation'
  | 'driver'
  | 'trip';

const financeGroupByValues: FinanceGroupByEnum[] = [
  'day',
  'harvestArea',
  'weighingStation',
  'driver',
  'trip',
];

export class FinanceReportQueryDto extends AnalyticsRangeQueryDto {
  @ApiPropertyOptional({
    enum: financeGroupByValues,
    example: 'day',
  })
  @IsOptional()
  @IsIn(financeGroupByValues)
  groupBy?: FinanceGroupByEnum;
}
