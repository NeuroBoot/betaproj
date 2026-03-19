import { Injectable } from '@nestjs/common';
import { AttendanceRepository } from '../repository/attendance.repository';
import { CreateAttendanceDto } from '../dto/create-attendance.dto';

@Injectable()
export class AttendanceService {

  constructor(private repo: AttendanceRepository) {}

  create(dto: CreateAttendanceDto) {

  return this.repo.create({
    recordDate: new Date(dto.recordDate),
    student: { userAccountId: dto.studentId } as any,
    course: { courseId: dto.courseId } as any,
    staffId: dto.staffId,
    attendanceStatusId: dto.attendanceStatusId
  });

}

  findAll() {
    return this.repo.findAll();
  }

  statistics() {
    return this.repo.statistics();
  }
}