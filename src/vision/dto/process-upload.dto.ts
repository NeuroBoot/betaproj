import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProcessUploadDto {
  @ApiProperty({ description: 'Base64 encoded image string' })
  @IsString()
  @IsNotEmpty()
  imageBase64: string;

  @ApiProperty({ example: '12345', description: 'The unique student ID' })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({ example: 'Ziad', description: 'The name of the student' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'S1', description: 'The section ID' })
  @IsString()
  @IsNotEmpty()
  sectionId: string;
}
