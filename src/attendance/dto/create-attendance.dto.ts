import { IsInt, IsDateString } from 'class-validator';

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
}