import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { AttendanceRepository } from '../repository/attendance.repository';
import { CreateAttendanceDto } from '../dto/create-attendance.dto';
import { UpdateAttendanceDto } from '../dto/update-attendance.dto';
import { BulkAttendanceDto } from '../dto/bulk-attendance.dto';
import { UserRepository } from '../../users/repositories/user.repository';
import { CourseRepository } from '../../courses/repositories/course.repository';
import { AlertService } from '../../users/services/alert.service';
import { Role } from '../../common/enums/role.enum';
import { UserAccount } from '../../users/entities/user.entity';
import { In } from 'typeorm';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly attendanceRepo: AttendanceRepository,
    private readonly userRepo: UserRepository,
    private readonly courseRepo: CourseRepository,
    private readonly alertService: AlertService,
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
      relations: ['enrollments', 'instructor']
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${dto.courseId} not found`);
    }

    // 3. Permission check: Staff can only record attendance for their own courses
    if (user.userType === Role.STAFF && course.instructor?.userAccountId !== user.userAccountId) {
      throw new ForbiddenException('You can only record attendance for your own courses');
    }

    // 4. Verify Student is enrolled in Course
    const isEnrolled = course.enrollments?.some(e => e.studentId === student.userAccountId);
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
    const result = await this.attendanceRepo.create({
      recordDate: this.normalizeDate(dto.recordDate),
      student: student,
      course: course,
      staffId: effectiveStaffId,
      attendanceStatusId: dto.attendanceStatusId,
      room: dto.room,
      sessionType: dto.sessionType,
      sectionNumber: dto.sectionNumber,
      faceConfidence: dto.faceConfidence,
      checkInTime: dto.checkInTime,
    });

    // 7. Automatic Alert Check (Asynchronous)
    if (dto.attendanceStatusId !== 1) { // Only check if not Present to optimize
       this.alertService.checkStudentLowAttendance(student.userAccountId, course.courseId).catch(err => {
         console.error(`[Alert Error] Failed to check low attendance for student ${student.userAccountId}:`, err);
       });
    }

    return result;
  }

  async getStudentDiagram(userId: number) {
    const student = await this.userRepo.findOne({
      where: { userAccountId: userId },
      relations: {
        enrollments: {
          course: true
        },
        attendanceRecords: {
          course: true
        }
      }
    });

    if (!student) throw new NotFoundException(`Student with ID ${userId} not found`);

    const enrolledCourses = (student.enrollments || []).map(e => e.course);

    const diagram = {
      student: {
        name: student.username,
        totalCredits: enrolledCourses.reduce((sum, c) => sum + (Number(c.credits) || 0), 0),
      },
      structure: enrolledCourses.map(course => ({
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
      courses: enrolledCourses.map(course => {
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
        topCourse: enrolledCourses[0]?.name || 'N/A',
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
      relations: ['enrollments', 'instructor']
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
    const processedStudentIds = new Set<number>();

    for (const item of dto.attendance) {
      const sId = parseInt(item.studentId);
      const student = studentMap.get(sId);
      
      if (!student) {
        skippedStudents.push(item.studentId);
        continue;
      }

      // Verify enrollment
      const isEnrolled = course.enrollments?.some(e => e.studentId === student.userAccountId);
      if (!isEnrolled) {
        skippedStudents.push(`${item.studentId} (Not enrolled)`);
        continue;
      }

      recordsToSave.push({
        recordDate: this.normalizeDate(dto.date),
        student: student,
        course: course,
        staffId: user.userAccountId,
        attendanceStatusId: this.mapStatusToId(item.status),
        room: 'Manual Bulk',
        sessionType: 'SECTION',
        sectionNumber: parseInt(dto.section) || 1,
      });
      processedStudentIds.add(student.userAccountId);
    }

    if (recordsToSave.length === 0) {
      throw new BadRequestException(`No records were saved. Found issues with: ${skippedStudents.join(', ')}`);
    }

    const savedRecords = await this.attendanceRepo.saveMany(recordsToSave);

    // Automatic Alert Check for affected students
    processedStudentIds.forEach(sId => {
      this.alertService.checkStudentLowAttendance(sId, course.courseId).catch(() => {});
    });

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

  async findAllPaginated(page: number, limit: number, filters: any, user: UserAccount) {
    let courseIds: number[] = [];
    
    if (user.userType === Role.STAFF) {
      const staffCourses = await this.courseRepo.findByInstructor(user.userAccountId);
      courseIds = staffCourses.map(c => c.courseId);
      if (courseIds.length === 0) return { data: [], total: 0, page, limit, totalPages: 0 };
    }
    
    return this.attendanceRepo.findAllWithFilters(page, limit, filters, courseIds);
  }

  async findAll(user: UserAccount, query?: any) {
    if (user.userType === Role.ADMIN) {
      return this.attendanceRepo.findAll();
    }

    if (user.userType === Role.STAFF) {
      if (query?.courseId) {
        // Use findAllPaginated logic instead which handles optional date.
        const result = await this.attendanceRepo.findAllWithFilters(1, 1000, {
          courseId: parseInt(query.courseId),
          section: parseInt(query.section) || undefined,
          date: query.date
        });
        return result.data;
      }
      return this.attendanceRepo.findByStaff(user.userAccountId);
    }

    if (user.userType === Role.STUDENT) {
      return this.attendanceRepo.findByStudent(user.userAccountId);
    }

    return [];
  }

  async getStudentAttendance(studentId: number, courseId?: number) {
    return this.attendanceRepo.findByStudent(studentId, courseId);
  }

  async getStudentTracking(studentId: number, courseId: number) {
    const student = await this.userRepo.findById(studentId);
    if (!student) throw new NotFoundException('Student not found');

    const course = await this.courseRepo.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');

    const records = await this.attendanceRepo.findByStudent(studentId, courseId);
    if (records.length === 0) {
      return { student: student.username, course: course.name, status: 'No records', riskLevel: 'N/A' };
    }

    // 1. Calculate Rate
    const presentCount = records.filter(r => r.attendanceStatusId === 1 || r.attendanceStatusId === 3).length;
    const rate = (presentCount / records.length) * 100;

    // 2. Calculate Consecutive Absences (Current Streak)
    let consecutiveAbsences = 0;
    for (const record of records) { // Records are DESC by date
      if (record.attendanceStatusId === 2) {
        consecutiveAbsences++;
      } else {
        break;
      }
    }

    // 3. Trend Analysis (Compare last 3 sessions vs previous 3)
    let trend = 'Stable';
    if (records.length >= 6) {
      const recent = records.slice(0, 3).filter(r => r.attendanceStatusId === 1).length;
      const older = records.slice(3, 6).filter(r => r.attendanceStatusId === 1).length;
      if (recent > older) trend = 'Improving';
      if (recent < older) trend = 'Declining';
    }

    // 4. Risk Level Logic
    let riskLevel = 'Low';
    if (rate < 75 || consecutiveAbsences >= 2) riskLevel = 'Medium';
    if (rate < 60 || consecutiveAbsences >= 3) riskLevel = 'High';

    return {
      student: { id: studentId, name: student.username },
      course: { id: courseId, name: course.name },
      metrics: {
        attendanceRate: rate.toFixed(1) + '%',
        totalSessions: records.length,
        consecutiveAbsences,
        trend,
        riskLevel,
      },
      summary: `Student has attended ${presentCount}/${records.length} sessions. Currently on a ${consecutiveAbsences} session absence streak.`
    };
  }

  async getCourseAttendance(courseId: number, section?: number, date?: string) {
    const result = await this.attendanceRepo.findAllWithFilters(1, 1000, {
      courseId,
      section,
      date
    });
    return result.data;
  }

  async isStaffAuthorizedForCourse(staffId: number, courseId: number): Promise<boolean> {
    const course = await this.courseRepo.findById(courseId);
    return course?.instructor?.userAccountId === staffId;
  }

  async statistics(user: UserAccount, courseId?: number) {
    if (user.userType === Role.ADMIN) {
      return this.attendanceRepo.getDetailedStatistics(courseId);
    } else if (user.userType === Role.STAFF) {
      // If courseId is provided, check if staff is authorized
      if (courseId) {
        const isAuthorized = await this.isStaffAuthorizedForCourse(user.userAccountId, courseId);
        if (!isAuthorized) throw new ForbiddenException('You are not authorized for this course');
        return this.attendanceRepo.getDetailedStatistics(courseId);
      }
      return this.attendanceRepo.statisticsByStaff(user.userAccountId);
    } else if (user.userType === Role.STUDENT) {
      return this.attendanceRepo.statisticsByStudent(user.userAccountId);
    }
    
    return [];
  }

  async update(recordId: number, dto: UpdateAttendanceDto, userId: number, userRole: string) {
    const record = await this.attendanceRepo.findOneById(recordId);
    if (!record) {
      throw new NotFoundException(`Attendance record with ID ${recordId} not found`);
    }
    
    // Only admin or the staff who created can update
    if (userRole !== Role.ADMIN && record.staffId !== userId) {
      throw new ForbiddenException('You are not authorized to update this record');
    }
    
    const updateData: any = { ...dto };
    if (dto.recordDate) {
      updateData.recordDate = this.normalizeDate(dto.recordDate);
    }
    
    return this.attendanceRepo.update(recordId, updateData);
  }

  async delete(recordId: number, userRole: string) {
    const record = await this.attendanceRepo.findOneById(recordId);
    if (!record) {
      throw new NotFoundException(`Attendance record with ID ${recordId} not found`);
    }
    
    // Only admin can delete
    if (userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only administrators can delete attendance records');
    }
    
    return this.attendanceRepo.delete(recordId);
  }

  private normalizeDate(dateString: string): Date {
    // If it's already a full ISO string, just parse it and set time to 0
    // If it's just YYYY-MM-DD, append T00:00:00Z
    if (dateString.includes('T')) {
      const date = new Date(dateString);
      date.setUTCHours(0, 0, 0, 0);
      return date;
    }
    return new Date(dateString + 'T00:00:00Z');
  }
}