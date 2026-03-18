import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCourseDto {
  @ApiProperty({ example: 'Mathematics', description: 'The name of the course' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'MATH101', description: 'Unique course code' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Introductory calculus and algebra', description: 'Course description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 4, description: 'Number of sections', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  sections?: number;

  @ApiProperty({ example: 2, description: 'User ID of the instructor (Staff)' })
  @IsInt()
  @IsNotEmpty()
  instructorId: number;

  @ApiProperty({ example: 1, description: 'User ID of the admin manager', required: false })
  @IsInt()
  @IsOptional()
  adminId?: number;
}
