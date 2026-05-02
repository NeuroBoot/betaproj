import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
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
}
