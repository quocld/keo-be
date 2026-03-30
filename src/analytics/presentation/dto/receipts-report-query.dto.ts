import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { AnalyticsRangeQueryDto } from './range-query.dto';
import { ReceiptStatusEnum } from '../../../ops/domain/receipt-status.enum';

export type ReceiptsGroupByEnum =
  | 'day'
  | 'harvestArea'
  | 'weighingStation'
  | 'driver'
  | 'trip';

const receiptsGroupByValues: ReceiptsGroupByEnum[] = [
  'day',
  'harvestArea',
  'weighingStation',
  'driver',
  'trip',
];

export class ReceiptsReportQueryDto extends AnalyticsRangeQueryDto {
  @ApiPropertyOptional({
    enum: receiptsGroupByValues,
    example: 'day',
  })
  @IsOptional()
  @IsIn(receiptsGroupByValues)
  groupBy?: ReceiptsGroupByEnum;

  @ApiPropertyOptional({
    enum: [...Object.values(ReceiptStatusEnum), 'all'],
    example: 'approved',
    description: 'Filter by receipt status. Use "all" to disable filtering.',
  })
  @IsOptional()
  @IsIn([...Object.values(ReceiptStatusEnum), 'all'])
  status?: ReceiptStatusEnum | 'all';
}
