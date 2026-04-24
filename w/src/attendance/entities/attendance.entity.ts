import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';
import { UserAccount } from '../../users/entities/user.entity';
import { Course } from '../../courses/entities/course.entity';

@Entity('attendance_records')
@Index(['studentId', 'courseId', 'recordDate', 'sectionNumber'], { unique: true })
export class Attendance {

  @PrimaryGeneratedColumn()
  recordId: number;

  @Column({ type: 'date' })
  recordDate: Date;

  @Column()
  studentId: number;

  @ManyToOne(() => UserAccount, user => user.attendanceRecords)
  @JoinColumn({ name: 'studentId' })
  student: UserAccount;

  @Column()
  courseId: number;

  @ManyToOne(() => Course, course => course.attendanceRecords)
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @Column()
  staffId: number;

  @Column()
  attendanceStatusId: number;

  @Column({ default: 1 })
  sectionNumber: number;

  @Column({ 
    type: 'varchar', 
    default: 'LECTURE' 
  })
  sessionType: string;

  @Column({ nullable: true })
  room: string;

  @Column({ type: 'float', nullable: true })
  faceConfidence: number;

  @Column({ type: 'time', nullable: true })
  checkInTime: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}