import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateVehicleDto {
  @ApiProperty({ example: '51H-123.45' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  plate: string;

  @ApiPropertyOptional({ example: 'Xe tải 5 tấn' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: 'active' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Required when creating as admin: fleet owner user id.',
    example: 2,
  })
  @IsOptional()
  @IsNumber()
  ownerId?: number;
}
