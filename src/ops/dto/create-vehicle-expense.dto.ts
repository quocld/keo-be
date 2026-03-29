import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { VehicleExpenseTypeEnum } from '../domain/vehicle-expense-type.enum';

export class CreateVehicleExpenseDto {
  @ApiProperty({ enum: VehicleExpenseTypeEnum })
  @IsEnum(VehicleExpenseTypeEnum)
  expenseType: VehicleExpenseTypeEnum;

  @ApiProperty({ example: 500_000 })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: '2026-01-15T10:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  occurredAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
