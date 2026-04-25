import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

import { UserAccount } from '../../users/entities/user.entity';
import { Course } from '../../courses/entities/course.entity';

@Entity('attendance_records')
export class Attendance {

  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  recordId: number;

  @ApiProperty({ example: '2024-01-15' })
  @Column({ type: 'date' })
  recordDate: Date;

  @ApiProperty({ example: 1 })
  @Column()
  studentId: number;

  // relation with UserAccount (Student)
  @ManyToOne(() => UserAccount, user => user.attendanceRecords)
  @JoinColumn({ name: 'studentId' })
  student: UserAccount;

  @ApiProperty({ example: 1 })
  @Column()
  courseId: number;

  // relation with Course
  @ManyToOne(() => Course, course => course.attendanceRecords)
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @ApiProperty({ example: 2 })
  @Column()
  staffId: number;

  @ApiProperty({ example: 1, description: '1=Present, 2=Absent, 3=Late, 4=Excused' })
  @Column()
  attendanceStatusId: number;

  @ApiProperty({ example: 'R3', required: false })
  @Column({ nullable: true })
  room: string; // e.g., 'R3', 'N2'

  @ApiProperty({ example: 'LECTURE', enum: ['LECTURE', 'SECTION'] })
  @Column({
    type: 'varchar',
    default: 'LECTURE'
  })
  sessionType: string; // 'LECTURE' or 'SECTION'

  @ApiProperty({ example: 1, required: false })
  @Column({ nullable: true })
  sectionNumber: number;

  @ApiProperty({ example: 0.95, required: false })
  @Column({ type: 'float', nullable: true })
  faceConfidence: number;

  @ApiProperty({ example: '09:30:00', required: false })
  @Column({ type: 'time', nullable: true })
  checkInTime: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  @UpdateDateColumn()
  updatedAt: Date;
}