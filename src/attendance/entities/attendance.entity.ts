import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn
} from 'typeorm';

import { UserAccount } from '../../users/entities/user.entity';
import { Course } from '../../courses/entities/course.entity';

@Entity('attendance_records')
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

  @Column({ nullable: true })
  room: string; // e.g., 'R3', 'N2'

  @Column({
    type: 'varchar',
    default: 'LECTURE'
  })
  sessionType: string; // 'LECTURE' or 'SECTION'

  @Column({ nullable: true })
  sectionNumber: number;
}