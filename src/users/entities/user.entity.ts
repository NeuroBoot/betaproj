import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToMany } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { Course } from '../../courses/entities/course.entity';
import { Attendance } from '../../attendance/entities/attendance.entity';

/**
 * Database entity representing a user account in the system.
 * Maps to the 'UserAccount' table in MySQL.
 */
@Entity('UserAccount')
export class UserAccount {
  // Unique primary identifier for each user.
  @PrimaryGeneratedColumn()
  userAccountId: number;

  // Unique username for authentication purposes.
  @Column({ unique: true })
  username: string;

  // Securely hashed password string.
  @Column()
  password: string;

  // The classification of the user (Admin, Staff, or Student).
  @Column({
    type: 'simple-enum',
    enum: Role,
    default: Role.STUDENT,
  })
  userType: Role;

  // Flag for soft-deletion of the user record.
  @Column({ default: false })
  isDeleted: boolean;

  // Courses managed by this user (Admin only).
  @OneToMany(() => Course, (course) => course.admin)
  managedCourses: Course[];

  // Courses taught by this user (Staff only).
  @OneToMany(() => Course, (course) => course.instructor)
  taughtCourses: Course[];

  // Courses enrolled by this user (Student only).
  @ManyToMany(() => Course, (course) => course.students)
  enrolledCourses: Course[];

  // Attendance records for this user (Student only).
  @OneToMany(() => Attendance, (attendance) => attendance.student)
  attendanceRecords: Attendance[];

  // Automatically recorded timestamp of account creation.
  @CreateDateColumn()
  createdAt: Date;

  // Automatically updated timestamp of the last account modification.
  @UpdateDateColumn()
  updatedAt: Date;
}
