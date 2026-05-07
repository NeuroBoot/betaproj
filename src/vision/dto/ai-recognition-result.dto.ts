import { IsString, IsNumber, Min, Max, IsEnum, IsOptional } from 'class-validator';

export enum MatchStatus {
  MATCH = 'MATCH',
  NO_MATCH = 'NO_MATCH',
  NO_FACE_DETECTED = 'NO_FACE_DETECTED'
}

export class Model1ResponseDto {
  @IsString()
  studentId: string;

  @IsString()
  name: string;

  @IsString()
  embedding: string;

  @IsString()
  dateCreated: string;

  @IsString()
  versionOfModel: string;

  @IsString()
  status: string;
}

export class Model2ResponseDto {
  @IsString()
  studentId: string;

  @IsString()
  name: string;

  @IsString()
  embedding: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  match: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidenceScore: number;

  @IsString()
  versionOfModel: string;

  @IsEnum(MatchStatus)
  matchStatus: MatchStatus;

  @IsString()
  status: string;
}

export class AiRecognitionResultDto extends Model2ResponseDto {}
