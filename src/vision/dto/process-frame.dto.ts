import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProcessFrameDto {
  @ApiProperty({ description: 'Base64 encoded frame from camera' })
  @IsString()
  @IsNotEmpty()
  imageBase64: string;

  @ApiProperty({ example: 'S1', description: 'The section ID' })
  @IsString()
  @IsNotEmpty()
  sectionId: string;

  @ApiProperty({ example: 'sess_123', description: 'The session ID' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({ example: 1, description: 'The course ID' })
  @IsNumber()
  @IsNotEmpty()
  courseId: number;

  @ApiProperty({ example: 'LECTURE', description: 'The session type (LECTURE or SECTION)' })
  @IsString()
  @IsNotEmpty()
  sessionType: string;

  @ApiProperty({ example: '1', description: 'The lecture or section number' })
  @IsString()
  @IsNotEmpty()
  sessionNumber: string;

  @ApiProperty({ example: 'Room 301', description: 'The room location' })
  @IsString()
  @IsOptional()
  room?: string;
}

