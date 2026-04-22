import { IsInt, IsDateString, IsString, IsNotEmpty, IsEnum } from 'class-validator';

export class CreateAttendanceDto {
  @IsInt({ message: 'studentId must be an integer' })
  @IsNotEmpty({ message: 'studentId is required' })
  studentId: number;

  @IsInt({ message: 'courseId must be an integer' })
  @IsNotEmpty({ message: 'courseId is required' })
  courseId: number;

  @IsInt({ message: 'staffId must be an integer' })
  @IsNotEmpty({ message: 'staffId is required' })
  staffId: number;

  @IsInt({ message: 'attendanceStatusId must be an integer' })
  @IsNotEmpty({ message: 'attendanceStatusId is required' })
  attendanceStatusId: number;

  @IsDateString({}, { message: 'recordDate must be a valid ISO date string' })
  @IsNotEmpty({ message: 'recordDate is required' })
  recordDate: string;

  @IsInt({ message: 'sectionNumber must be an integer' })
  @IsNotEmpty({ message: 'sectionNumber is required' })
  sectionNumber: number;

  @IsString({ message: 'room must be a string' })
  @IsNotEmpty({ message: 'room is required' })
  room: string;

  @IsString({ message: 'sessionType must be a string' })
  @IsNotEmpty({ message: 'sessionType is required' })
  sessionType: string; // 'LECTURE' or 'SECTION'
}