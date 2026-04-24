import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from '../entities/alert.entity';
import { AttendanceRepository } from '../../attendance/repository/attendance.repository';
import { CourseRepository } from '../../courses/repositories/course.repository';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private alertRepo: Repository<Alert>,
    private readonly attendanceRepo: AttendanceRepository,
    private readonly courseRepo: CourseRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async checkLowAttendance(courseId: number, threshold: number = 75) {
    const course = await this.courseRepo.findById(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    
    const enrolledStudents = await this.courseRepo.getEnrolledStudents(courseId);
    const alerts = [];
    
    for (const student of enrolledStudents) {
      const records = await this.attendanceRepo.findByStudent(student.userAccountId, courseId);
      const total = records.length;
      const present = records.filter(r => r.attendanceStatusId === 1 || r.attendanceStatusId === 3).length;
      const attendanceRate = total > 0 ? (present / total) * 100 : 0;
      
      if (attendanceRate < threshold && attendanceRate > 0) {
        const title = 'Low Attendance Warning';
        const message = `⚠️ Attendance Alert: Your attendance in ${course.name} is ${attendanceRate.toFixed(2)}% which is below ${threshold}%.`;
        
        const alert = await this.sendAlert(student.userAccountId, message, 'warning', title);
        
        alerts.push({
          studentId: student.userAccountId,
          studentName: student.username,
          total,
          present,
          attendanceRate: attendanceRate.toFixed(2),
          alert
        });
      }
    }
    
    return {
      courseId,
      courseName: course.name,
      threshold,
      studentsBelowThreshold: alerts.length,
      alerts
    };
  }

  async sendAlert(userId: number, message: string, type: string = 'info', title: string = 'Alert') {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    const alert = this.alertRepo.create({
      userId,
      message,
      type,
      title,
      isRead: false,
      createdAt: new Date()
    });
    
    await this.alertRepo.save(alert);
    
    console.log(`[ALERT] To user ${userId}: ${message}`);
    
    return alert;
  }

  async getUserAlerts(userId: number, unreadOnly: boolean = false) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }
    
    return this.alertRepo.find({
      where,
      order: { createdAt: 'DESC' }
    });
  }

  async markAsRead(alertId: number, userId: number) {
    const alert = await this.alertRepo.findOne({ where: { id: alertId, userId } });
    if (!alert) {
      throw new NotFoundException('Alert not found');
    }
    
    alert.isRead = true;
    await this.alertRepo.save(alert);
    
    return alert;
  }

  async sendBatchAlerts(userIds: number[], message: string, type: string = 'info', title: string = 'Batch Alert') {
    const results = [];
    
    for (const userId of userIds) {
      try {
        const alert = await this.sendAlert(userId, message, type, title);
        results.push({ userId, success: true, alert });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        results.push({ userId, success: false, error: errorMessage });
      }
    }
    
    return results;
  }

  async getLowAttendanceReport(courseId: number, threshold: number = 75) {
    const course = await this.courseRepo.findById(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    
    const enrolledStudents = await this.courseRepo.getEnrolledStudents(courseId);
    const report = [];
    
    for (const student of enrolledStudents) {
      const records = await this.attendanceRepo.findByStudent(student.userAccountId, courseId);
      const total = records.length;
      const present = records.filter(r => r.attendanceStatusId === 1 || r.attendanceStatusId === 3).length;
      const absent = records.filter(r => r.attendanceStatusId === 2).length;
      const late = records.filter(r => r.attendanceStatusId === 3).length;
      const attendanceRate = total > 0 ? (present / total) * 100 : 0;
      
      report.push({
        studentId: student.userAccountId,
        studentName: student.username,
        total,
        present,
        absent,
        late,
        attendanceRate: attendanceRate.toFixed(2),
        isLow: attendanceRate < threshold
      });
    }
    
    return {
      courseId,
      courseName: course.name,
      threshold,
      totalStudents: enrolledStudents.length,
      studentsWithLowAttendance: report.filter(s => s.isLow).length,
      report
    };
  }
}