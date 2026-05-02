import { IsString, IsNumber, Min, Max, IsEnum } from 'class-validator';

export enum MatchStatus {
  MATCH = 'MATCH',
  NO_MATCH = 'NO_MATCH',
  NO_FACE_DETECTED = 'NO_FACE_DETECTED'
}

export class AiRecognitionResultDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  match: number;

  @IsString()
  studentId: string;

  @IsEnum(MatchStatus)
  matchStatus: MatchStatus;
}
