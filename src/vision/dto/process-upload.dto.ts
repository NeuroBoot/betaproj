import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProcessUploadDto {
  @ApiProperty({ description: 'Array of Base64 encoded image strings', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  imagesBase64: string[];

  @ApiProperty({ example: '12345', description: 'The unique student ID' })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({ example: 'Ziad', description: 'The name of the student' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'S1', description: 'The section ID', required: false })
  @IsString()
  @IsOptional()
  sectionId?: string;
}
