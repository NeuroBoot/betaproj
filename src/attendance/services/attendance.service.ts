import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { AttendanceRepository } from '../repository/attendance.repository';
import { CreateAttendanceDto } from '../dto/create-attendance.dto';
import { BulkAttendanceDto } from '../dto/bulk-attendance.dto';
import { UserRepository } from '../../users/repositories/user.repository';
import { CourseRepository } from '../../courses/repositories/course.repository';
import { Role } from '../../common/enums/role.enum';
import { UserAccount } from '../../users/entities/user.entity';
import { In } from 'typeorm';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly attendanceRepo: AttendanceRepository,
    private readonly userRepo: UserRepository,
    private readonly courseRepo: CourseRepository,
  ) {}

  async create(dto: CreateAttendanceDto, user: UserAccount) {
    // 1. Verify Student exists and is actually a student
    const student = await this.userRepo.findById(dto.studentId);
    if (!student || student.userType !== Role.STUDENT) {
      throw new NotFoundException(`Student with ID ${dto.studentId} not found or is not a student`);
    }

    // 2. Verify Course exists
    const course = await this.courseRepo.findOne({
      where: { courseId: dto.courseId, isDeleted: false },
      relations: ['students', 'instructor']
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${dto.courseId} not found`);
    }

    // 3. Permission check: Staff can only record attendance for their own courses
    if (user.userType === Role.STAFF && course.instructor?.userAccountId !== user.userAccountId) {
      throw new ForbiddenException('You can only record attendance for your own courses');
    }

    // 4. Verify Student is enrolled in Course
    const isEnrolled = course.students?.some(s => s.userAccountId === student.userAccountId);
    if (!isEnrolled) {
      throw new ForbiddenException(`Student ${student.username} is not enrolled in course ${course.name}`);
    }

    // 5. Determine and verify staffId
    let effectiveStaffId: number;
    if (user.userType === Role.STAFF) {
      effectiveStaffId = user.userAccountId;
    } else {
      // For Admin, verify the provided staffId exists and is a staff member
      const staff = await this.userRepo.findById(dto.staffId);
      if (!staff || staff.userType !== Role.STAFF) {
        throw new NotFoundException(`Staff member with ID ${dto.staffId} not found`);
      }
      effectiveStaffId = dto.staffId;
    }

    // 6. Create and save record
    return this.attendanceRepo.create({
      recordDate: new Date(dto.recordDate),
      student: student,
      course: course,
      staffId: effectiveStaffId,
      attendanceStatusId: dto.attendanceStatusId,
      room: dto.room,
      sessionType: dto.sessionType,
      sectionNumber: dto.sectionNumber,
    });
  }

  async getStudentDiagram(userId: number) {
    const student = await this.userRepo.findOne({
      where: { userAccountId: userId },
      relations: {
        enrolledCourses: true,
        attendanceRecords: {
          course: true
        }
      }
    });

    if (!student) throw new NotFoundException(`Student with ID ${userId} not found`);

    const diagram = {
      student: {
        name: student.username,
        totalCredits: (student.enrolledCourses || []).reduce((sum, c) => sum + (Number(c.credits) || 0), 0),
      },
      structure: (student.enrolledCourses || []).map(course => ({
        id: `course-${course.courseId}`,
        label: course.name,
        type: 'course',
        credits: Number(course.credits) || 0,
        children: [
          {
            id: `course-${course.courseId}-lec`,
            label: 'Lectures',
            type: 'session_group',
            room: 'R3/R2', 
            stats: this.calculateSessionStats(student.attendanceRecords || [], course.courseId, 'LECTURE')
          },
          {
            id: `course-${course.courseId}-sec`,
            label: 'Sections',
            type: 'session_group',
            room: 'N2/N3',
            stats: this.calculateSessionStats(student.attendanceRecords || [], course.courseId, 'SECTION')
          }
        ]
      })),
      courses: (student.enrolledCourses || []).map(course => {
        const records = (student.attendanceRecords || []).filter(r => r.course?.courseId === course.courseId);
        return {
          courseName: course.name,
          credits: Number(course.credits) || 0,
          attendanceRate: records.length > 0 
            ? Math.round((records.filter(r => r.attendanceStatusId === 1).length / records.length) * 100)
            : 0
        };
      }),
      metrics: {
        avg: '88%',
        topCourse: student.enrolledCourses?.[0]?.name || 'N/A',
        riskStudents: 0,
        aiAccuracy: '99.2%'
      }
    };

    return diagram;
  }

  private calculateSessionStats(records: any[], courseId: number, type: string) {
    const filtered = records.filter(r => r.course?.courseId === courseId && r.sessionType === type);
    return {
      attended: filtered.filter(r => r.attendanceStatusId === 1).length,
      total: filtered.length,
      rooms: [...new Set(filtered.map(r => r.room).filter(Boolean))]
    };
  }

  async saveBulk(dto: BulkAttendanceDto, user: UserAccount) {
    const courseId = parseInt(dto.courseId);
    if (isNaN(courseId)) throw new BadRequestException(`Invalid courseId: ${dto.courseId}`);

    const course = await this.courseRepo.findOne({
      where: { courseId, isDeleted: false },
      relations: ['students', 'instructor']
    });
    if (!course) throw new NotFoundException(`Course with ID ${courseId} not found`);

    // Permission check
    if (user.userType === Role.STAFF && course.instructor?.userAccountId !== user.userAccountId) {
      throw new ForbiddenException('You can only record attendance for your own courses');
    }

    const studentIds = dto.attendance.map(a => parseInt(a.studentId)).filter(id => !isNaN(id));
    if (studentIds.length === 0) throw new BadRequestException('No valid student IDs provided in attendance list');

    const students = await this.userRepo.find({
      where: { userAccountId: In(studentIds), isDeleted: false, userType: Role.STUDENT }
    });

    const studentMap = new Map(students.map(s => [s.userAccountId, s]));
    const recordsToSave = [];
    const skippedStudents = [];

    for (const item of dto.attendance) {
      const sId = parseInt(item.studentId);
      const student = studentMap.get(sId);
      
      if (!student) {
        skippedStudents.push(item.studentId);
        continue;
      }

      // Verify enrollment
      const isEnrolled = course.students?.some(s => s.userAccountId === student.userAccountId);
      if (!isEnrolled) {
        skippedStudents.push(`${item.studentId} (Not enrolled)`);
        continue;
      }

      recordsToSave.push({
        recordDate: new Date(dto.date),
        student: student,
        course: course,
        staffId: user.userAccountId,
        attendanceStatusId: this.mapStatusToId(item.status),
        room: 'Manual Bulk',
        sessionType: 'SECTION',
        sectionNumber: parseInt(dto.section) || 1,
      });
    }

    if (recordsToSave.length === 0) {
      throw new BadRequestException(`No records were saved. Found issues with: ${skippedStudents.join(', ')}`);
    }

    const savedRecords = await this.attendanceRepo.saveMany(recordsToSave);

    return {
      message: `Successfully saved ${savedRecords.length} attendance records.`,
      savedCount: savedRecords.length,
      skippedCount: skippedStudents.length,
      skipped: skippedStudents.length > 0 ? skippedStudents : undefined
    };
  }

  private mapStatusToId(status: string): number {
    const map = { 'Present': 1, 'Absent': 2, 'Late': 3, 'Excused': 4 };
    return map[status] || 2; // Default to Absent if unknown
  }

  async findAll(user: UserAccount, query?: any) {
    if (user.userType === Role.ADMIN) {
      return this.attendanceRepo.findAll();
    }

    if (user.userType === Role.STAFF) {
      if (query?.courseId) {
        return this.attendanceRepo.findByFilter({
          courseId: parseInt(query.courseId),
          section: parseInt(query.section) || 1,
          date: query.date || new Date().toISOString()
        });
      }
      return this.attendanceRepo.findByStaff(user.userAccountId);
    }

    if (user.userType === Role.STUDENT) {
      return this.attendanceRepo.findByStudent(user.userAccountId);
    }

    return [];
  }

  async statistics(user: UserAccount) {
    let rawStats;
    if (user.userType === Role.ADMIN) {
      rawStats = await this.attendanceRepo.statistics();
    } else if (user.userType === Role.STAFF) {
      rawStats = await this.attendanceRepo.statisticsByStaff(user.userAccountId);
    } else if (user.userType === Role.STUDENT) {
      rawStats = await this.attendanceRepo.statisticsByStudent(user.userAccountId);
    } else {
      return [];
    }
    
    const statusMap = {
      1: 'Present',
      2: 'Absent',
      3: 'Late',
      4: 'Excused'
    };

    return rawStats.map(stat => ({
      status: statusMap[stat.status] || `Unknown (${stat.status})`,
      count: parseInt(stat.count) || 0
    }));
  }
}