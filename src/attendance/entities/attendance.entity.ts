import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn
} from 'typeorm';

import { UserAccount } from '../../users/entities/user.entity';
import { Course } from '../../courses/entities/course.entity';

@Entity('AttendanceRecord')
export class Attendance {

  @PrimaryGeneratedColumn()
  recordId: number;

  @Column()
  recordDate: Date;

  // relation with UserAccount (Student)
  @ManyToOne(() => UserAccount, user => user.attendanceRecords)
  @JoinColumn({ name: 'studentId' })
  student: UserAccount;

  // relation with Course
  @ManyToOne(() => Course, course => course.attendanceRecords)
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @Column()
  staffId: number;

  @Column()
  attendanceStatusId: number;
}