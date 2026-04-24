import { IsInt, IsDateString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAttendanceDto {

  @ApiProperty({ required: false, example: 1 })
  @IsOptional()
  @IsInt()
  @IsIn([1, 2, 3, 4])
  attendanceStatusId?: number;

  @ApiProperty({ required: false, example: '2024-01-15' })
  @IsOptional()
  @IsDateString()
  recordDate?: string;

  @ApiProperty({ required: false, example: 2 })
  @IsOptional()
  @IsInt()
  section?: number;

  @ApiProperty({ required: false, example: 'lecture', enum: ['lecture', 'section'] })
  @IsOptional()
  @IsIn(['lecture', 'section'])
  lectureType?: 'lecture' | 'section';
}