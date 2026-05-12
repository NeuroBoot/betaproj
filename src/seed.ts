import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UserRepository } from './users/repositories/user.repository';
import { CourseRepository } from './courses/repositories/course.repository';
import { CourseEnrollment } from './courses/entities/course-enrollment.entity';
import { Attendance } from './attendance/entities/attendance.entity';
import { Alert } from './users/entities/alert.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './common/enums/role.enum';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const userRepo = app.get(UserRepository);
  const courseRepo = app.get(CourseRepository);
  const enrollmentRepo = app.get<Repository<CourseEnrollment>>(getRepositoryToken(CourseEnrollment));
  const attendanceRepo = app.get<Repository<Attendance>>(getRepositoryToken(Attendance));
  const alertRepo = app.get<Repository<Alert>>(getRepositoryToken(Alert));

  console.log('Seeding Database with Realistic Mock Data...');

  // 1. Clean Database (Optional: truncate tables)
  console.log('Clearing old data...');
  await alertRepo.query('SET FOREIGN_KEY_CHECKS = 0;');
  await alertRepo.clear();
  await attendanceRepo.clear();
  await enrollmentRepo.clear();
  await courseRepo.query('TRUNCATE TABLE courses;');
  await userRepo.query('TRUNCATE TABLE users;');
  await alertRepo.query('SET FOREIGN_KEY_CHECKS = 1;');

  const hashedPassword = await bcrypt.hash('password123', 10);

  // 2. Create Admin
  const admin = await userRepo.save(userRepo.create({
    username: 'admin',
    password: hashedPassword,
    fullName: 'System Administrator',
    email: 'admin@facemark.edu',
    userType: Role.ADMIN,
  }));
  console.log('Admin created.');

  // 3. Create Staff
  const staff1 = await userRepo.save(userRepo.create({ username: 'dr_ahmed', password: hashedPassword, fullName: 'Dr. Ahmed Hassan', email: 'ahmed@facemark.edu', userType: Role.STAFF }));
  const staff2 = await userRepo.save(userRepo.create({ username: 'dr_sara', password: hashedPassword, fullName: 'Dr. Sara Ali', email: 'sara@facemark.edu', userType: Role.STAFF }));
  const staff3 = await userRepo.save(userRepo.create({ username: 'dr_omar', password: hashedPassword, fullName: 'Dr. Omar Farouk', email: 'omar@facemark.edu', userType: Role.STAFF }));
  console.log('Staff created.');

  // 4. Create Students
  const students = [];
  for (let i = 1; i <= 30; i++) {
    students.push(await userRepo.save(userRepo.create({
      username: `student${i}`,
      password: hashedPassword,
      fullName: `Student Name ${i}`,
      email: `student${i}@facemark.edu`,
      userType: Role.STUDENT,
      // No fake embeddings - forcing real registration
      faceEmbedding: null,
    })));
  }
  console.log('Students created.');

  // 5. Create Courses
  const course1 = await courseRepo.save(courseRepo.create({ name: 'Advanced Mathematics', code: 'MATH201', description: 'Calculus and Algebra', sections: 2, credits: 3, instructor: staff1, admin: admin, schedule: 'Mon/Wed 10:00 AM', room: 'Hall A' }));
  const course2 = await courseRepo.save(courseRepo.create({ name: 'Computer Science 101', code: 'CS101', description: 'Intro to Programming', sections: 4, credits: 4, instructor: staff2, admin: admin, schedule: 'Tue/Thu 12:00 PM', room: 'Lab 3' }));
  const course3 = await courseRepo.save(courseRepo.create({ name: 'Physics Mechanics', code: 'PHYS101', description: 'Newtonian Physics', sections: 1, credits: 3, instructor: staff3, admin: admin, schedule: 'Sun 09:00 AM', room: 'Hall B' }));
  const course4 = await courseRepo.save(courseRepo.create({ name: 'Artificial Intelligence', code: 'AI400', description: 'Machine Learning Basics', sections: 1, credits: 4, instructor: staff1, admin: admin, schedule: 'Wed 02:00 PM', room: 'Lab 1' }));
  console.log('Courses created.');

  // 6. Enroll Students
  const enrollments = [];
  const s1 = students[0]; // student1
  
  // Enroll student1 in ALL courses for testing
  enrollments.push(await enrollmentRepo.save(enrollmentRepo.create({ courseId: course1.courseId, studentId: s1.userAccountId, section: 'A' })));
  enrollments.push(await enrollmentRepo.save(enrollmentRepo.create({ courseId: course2.courseId, studentId: s1.userAccountId, section: 'B' })));
  enrollments.push(await enrollmentRepo.save(enrollmentRepo.create({ courseId: course3.courseId, studentId: s1.userAccountId, section: 'C' }))); // Dr. Omar's course
  enrollments.push(await enrollmentRepo.save(enrollmentRepo.create({ courseId: course4.courseId, studentId: s1.userAccountId, section: 'D' })));

  // Enroll other students normally
  for (const student of students.slice(1, 20)) {
    enrollments.push(await enrollmentRepo.save(enrollmentRepo.create({ courseId: course1.courseId, studentId: student.userAccountId, section: 'A' })));
  }
  for (const student of students.slice(5, 25)) {
    enrollments.push(await enrollmentRepo.save(enrollmentRepo.create({ courseId: course2.courseId, studentId: student.userAccountId, section: 'B' })));
  }
  for (const student of students.slice(10, 30)) {
    enrollments.push(await enrollmentRepo.save(enrollmentRepo.create({ courseId: course3.courseId, studentId: student.userAccountId, section: 'C' })));
  }
  console.log('Enrollments created.');

  // 7. Generate Attendance Records (Past 3 days)
  const today = new Date();
  for (let d = 1; d <= 3; d++) {
    const recordDate = new Date(today);
    recordDate.setDate(recordDate.getDate() - d);
    const dateStr = recordDate.toISOString().split('T')[0];

    for (const enrollment of enrollments) {
      // 80% Present, 15% Absent, 5% Late
      const rand = Math.random();
      let statusId = 1; // Present
      if (rand > 0.95) statusId = 3; // Late
      else if (rand > 0.8) statusId = 2; // Absent

      await attendanceRepo.save(attendanceRepo.create({
        student: { userAccountId: enrollment.studentId },
        course: { courseId: enrollment.courseId },
        recordDate: dateStr,
        checkInTime: statusId !== 2 ? new Date(recordDate.setHours(10, Math.floor(Math.random() * 30), 0)).toISOString() : null,
        attendanceStatusId: statusId,
        sessionId: `SES_${enrollment.courseId}_${dateStr}`
      } as any));
    }
  }
  console.log('Attendance records created.');

  // 8. Generate Alerts
  await alertRepo.save(alertRepo.create({ type: 'Warning', message: 'Low attendance detected for 5 students in CS101.', isRead: false }));
  await alertRepo.save(alertRepo.create({ type: 'Danger', message: 'Camera disconnected in Hall A.', isRead: false }));
  await alertRepo.save(alertRepo.create({ type: 'Info', message: 'System backup completed successfully.', isRead: true }));
  await alertRepo.save(alertRepo.create({ type: 'Success', message: 'New semester data imported.', isRead: true }));
  console.log('Alerts created.');

  console.log('Database seeding completed successfully!');
  await app.close();
}

bootstrap().catch(err => {
  console.error('Seeding failed!', err);
  process.exit(1);
});