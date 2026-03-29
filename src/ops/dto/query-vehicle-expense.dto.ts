import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { VehicleExpenseTypeEnum } from '../domain/vehicle-expense-type.enum';

export class FilterVehicleExpenseDto {
  @ApiPropertyOptional({ enum: VehicleExpenseTypeEnum })
  @IsOptional()
  @IsEnum(VehicleExpenseTypeEnum)
  expenseType?: VehicleExpenseTypeEnum | null;
}

export class QueryVehicleExpenseDto {
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
    description: 'JSON string: {"expenseType":"fuel"}',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value
      ? plainToInstance(FilterVehicleExpenseDto, JSON.parse(value))
      : undefined,
  )
  @ValidateNested()
  @Type(() => FilterVehicleExpenseDto)
  filters?: FilterVehicleExpenseDto | null;
}
