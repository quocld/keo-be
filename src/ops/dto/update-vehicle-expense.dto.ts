import { PartialType } from '@nestjs/swagger';
import { CreateVehicleExpenseDto } from './create-vehicle-expense.dto';

export class UpdateVehicleExpenseDto extends PartialType(
  CreateVehicleExpenseDto,
) {}
