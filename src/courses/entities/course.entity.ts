import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { UserAccount } from '../../users/entities/user.entity';
import { Attendance } from '../../attendance/entities/attendance.entity';

/**
 * Database entity representing a course in the system.
 */
@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn()
  courseId: number;

  @Column()
  name: string;

  @Column({ unique: true })
  code: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: 1 })
  sections: number;

  // The admin who manages/created the course.
  @ManyToOne(() => UserAccount)
  admin: UserAccount;

  // The instructor (Staff) for the course.
  @ManyToOne(() => UserAccount)
  instructor: UserAccount;

  // Students enrolled in the course.
  @ManyToMany(() => UserAccount, (user) => user.enrolledCourses)
  @JoinTable({
    name: 'course_enrollments',
    joinColumn: { name: 'courseId', referencedColumnName: 'courseId' },
    inverseJoinColumn: { name: 'userAccountId', referencedColumnName: 'userAccountId' },
  })
  students: UserAccount[];

  // Attendance records for this course.
  @OneToMany(() => Attendance, (attendance) => attendance.course)
  attendanceRecords: Attendance[];

  @Column({ default: 3 })
  credits: number;

  @Column({ nullable: true })
  schedule: string;

  @Column({ nullable: true })
  room: string;

  @Column({ type: 'text', nullable: true })
  scheduleJson: string; // Storing schedule as JSON string for simplicity in SQLite

  @Column({ default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
