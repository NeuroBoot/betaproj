import { IsInt, IsDateString, IsString } from 'class-validator';

export class CreateAttendanceDto {

  @IsInt()
  studentId: number;

  @IsInt()
  courseId: number;

  @IsInt()
  staffId: number;

  @IsInt()
  attendanceStatusId: number;

  @IsDateString()
  recordDate: string;
@IsInt()
sectionNumber: number;

@IsString()
room: string;

@IsString()
sessionType: string; // 'LECTURE' or 'SECTION'
}