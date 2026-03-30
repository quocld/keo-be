import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { AnalyticsRangeQueryDto } from './range-query.dto';
import { TripStatusEnum } from '../../../ops/domain/trip-status.enum';

export type TripsGroupByEnum = 'day' | 'status' | 'driver' | 'harvestArea';

const tripsGroupByValues: TripsGroupByEnum[] = [
  'day',
  'status',
  'driver',
  'harvestArea',
];

export class TripsReportQueryDto extends AnalyticsRangeQueryDto {
  @ApiPropertyOptional({
    enum: tripsGroupByValues,
    example: 'day',
  })
  @IsOptional()
  @IsIn(tripsGroupByValues)
  groupBy?: TripsGroupByEnum;

  @ApiPropertyOptional({
    enum: Object.values(TripStatusEnum),
    example: TripStatusEnum.inProgress,
    description: 'Optional status filter. Leave empty to include all.',
  })
  @IsOptional()
  @IsIn(Object.values(TripStatusEnum))
  status?: TripStatusEnum;
}
