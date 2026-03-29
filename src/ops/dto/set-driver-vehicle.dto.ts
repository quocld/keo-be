import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

/** Include `vehicleId` in JSON: UUID string to assign, or `null` to unassign. */
export class SetDriverVehicleDto {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'UUID to assign, or null to unassign (key must be sent).',
  })
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  vehicleId?: string | null;
}
