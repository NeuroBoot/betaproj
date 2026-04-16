import { Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceRepository } from '../repository/attendance.repository';
import { CreateAttendanceDto } from '../dto/create-attendance.dto';
import { UserRepository } from '../../users/repositories/user.repository';
import { CourseRepository } from '../../courses/repositories/course.repository';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly attendanceRepo: AttendanceRepository,
    private readonly userRepo: UserRepository,
    private readonly courseRepo: CourseRepository,
  ) {}

  async create(dto: CreateAttendanceDto) {
    // 1. Verify Student exists and is actually a student
    const student = await this.userRepo.findById(dto.studentId);
    if (!student || student.userType !== Role.STUDENT) {
      throw new NotFoundException(`Student with ID ${dto.studentId} not found`);
    }

    // 2. Verify Course exists
    const course = await this.courseRepo.findById(dto.courseId);
    if (!course) {
      throw new NotFoundException(`Course with ID ${dto.courseId} not found`);
    }

    // 3. Verify Staff exists and is staff
    const staff = await this.userRepo.findById(dto.staffId);
    if (!staff || staff.userType !== Role.STAFF) {
      throw new NotFoundException(`Staff member with ID ${dto.staffId} not found`);
    }

    // 4. Create and save record
    return this.attendanceRepo.create({
      recordDate: new Date(dto.recordDate),
      student: student,
      course: course,
      staffId: dto.staffId,
      attendanceStatusId: dto.attendanceStatusId,
    });
  }

  findAll() {
    return this.attendanceRepo.findAll();
  }

  async statistics() {
    const rawStats = await this.attendanceRepo.statistics();
    
    // Map status IDs to names (Matching frontend logic)
    const statusMap = {
      1: 'Present',
      2: 'Absent',
      3: 'Late',
      4: 'Excused'
    };

    return rawStats.map(stat => ({
      status: statusMap[stat.status] || `Unknown (${stat.status})`,
      count: parseInt(stat.count)
    }));
  }
}