import { IsInt, IsDateString, IsOptional, IsNumber, Min, Max, IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAttendanceDto {

  @ApiProperty({ example: 1, description: 'Student ID' })
  @IsInt()
  @Min(1)
  studentId: number;

  @ApiProperty({ example: 1, description: 'Course ID' })
  @IsInt()
  @Min(1)
  courseId: number;

  @ApiProperty({ example: 2, description: 'Staff/Admin ID' })
  @IsInt()
  @Min(1)
  staffId: number;

  @ApiProperty({ example: 1, description: '1=Present, 2=Absent, 3=Late, 4=Excused' })
  @IsInt()
  @IsIn([1, 2, 3, 4])
  attendanceStatusId: number;

  @ApiProperty({ example: '2024-01-15', description: 'Date of attendance' })
  @IsDateString()
  recordDate: string;

  @ApiProperty({ required: false, example: 1, description: 'Section number' })
  @IsOptional()
  @IsInt()
  @Min(1)
  section?: number;

  @ApiProperty({ required: false, example: 'lecture', enum: ['lecture', 'section'] })
  @IsOptional()
  @IsIn(['lecture', 'section'])
  lectureType?: 'lecture' | 'section';

  @ApiProperty({ required: false, example: 0.95 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  faceConfidence?: number;

  @ApiProperty({ required: false, example: '09:30:00' })
  @IsOptional()
  @IsString()
  checkInTime?: string;
}