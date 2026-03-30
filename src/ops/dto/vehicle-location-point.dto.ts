import { ApiProperty } from '@nestjs/swagger';

export class VehicleLocationPointDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  latitude: number;

  @ApiProperty()
  longitude: number;

  @ApiProperty({ nullable: true })
  speed: number | null;

  @ApiProperty({ nullable: true })
  accuracy: number | null;

  @ApiProperty()
  timestamp: string;
}
