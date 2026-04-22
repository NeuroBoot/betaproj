import { IsInt, IsString, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class IndividualAttendanceDto {
  @IsString()
  studentId: string;

  @IsString()
  status: string; // Present, Absent, Late

  @IsOptional()
  @IsString()
  time?: string;
}

export class BulkAttendanceDto {
  @IsString()
  courseId: string;

  @IsString()
  section: string;

  @IsString()
  date: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IndividualAttendanceDto)
  attendance: IndividualAttendanceDto[];
}
