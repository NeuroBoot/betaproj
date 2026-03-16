import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { Course } from '../../courses/entities/course.entity';

@Entity('AttendanceRecord')
export class Attendance {

  @PrimaryGeneratedColumn()
  recordId: number;

  @Column()
  recordDate: Date;

  // relation with User (Student)
  @ManyToOne(() => User, user => user.attendanceRecords)
  @JoinColumn({ name: 'studentId' })
  student: User;

  // relation with Course
  @ManyToOne(() => Course, course => course.attendanceRecords)
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @Column()
  staffId: number;

  @Column()
  attendanceStatusId: number;
}