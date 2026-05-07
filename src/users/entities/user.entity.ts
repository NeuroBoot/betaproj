import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../common/enums/role.enum';
import { Course } from '../../courses/entities/course.entity';
import { Attendance } from '../../attendance/entities/attendance.entity';
import { CourseEnrollment } from '../../courses/entities/course-enrollment.entity';

/**
 * Database entity representing a user account in the system.
 * Maps to the 'UserAccount' table in MySQL.
 */
@Entity('users')
export class UserAccount {
  // Unique primary identifier for each user.
  @ApiProperty({ example: 1, description: 'The unique identifier of the user' })
  @PrimaryGeneratedColumn()
  userAccountId: number;

  // Unique username for authentication purposes.
  @ApiProperty({ example: 'ziad_taha', description: 'The unique username of the user' })
  @Column({ unique: true })
  username: string;

  // Securely hashed password string.
  @ApiProperty({ example: 'hashed_password', description: 'The hashed password (hidden in responses usually)' })
  @Column()
  password: string;

  // The classification of the user (Admin, Staff, or Student).
  @ApiProperty({ enum: Role, default: Role.STUDENT, description: 'The role of the user' })
  @Column({
    type: 'simple-enum',
    enum: Role,
    default: Role.STUDENT,
  })
  userType: Role;

  // Flag for soft-deletion of the user record.
  @ApiProperty({ example: false, description: 'Soft deletion flag' })
  @Column({ default: false })
  isDeleted: boolean;

  // Courses managed by this user (Admin only).
  @OneToMany(() => Course, (course) => course.admin)
  managedCourses: Course[];

  // Courses taught by this user (Staff only).
  @OneToMany(() => Course, (course) => course.instructor)
  taughtCourses: Course[];

  // Courses enrolled by this user (Student only).
  @OneToMany(() => CourseEnrollment, (enrollment) => enrollment.student)
  enrollments: CourseEnrollment[];

  // Attendance records for this user (Student only).
  @OneToMany(() => Attendance, (attendance) => attendance.student)
  attendanceRecords: Attendance[];

  // Face recognition embedding data.
  @ApiProperty({ description: 'The AI face embedding for this user' })
  @Column({ type: 'text', nullable: true })
  faceEmbedding: string;

  // Version of the AI model used to generate the embedding.
  @ApiProperty({ description: 'The version of the model that generated the embedding' })
  @Column({ nullable: true })
  embeddingVersion: string;

  // Timestamp of when the embedding was last generated.
  @ApiProperty({ description: 'When the face embedding was created' })
  @Column({ nullable: true })
  embeddingCreatedAt: Date;

  // Automatically recorded timestamp of account creation.
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  @CreateDateColumn()
  createdAt: Date;

  // Automatically updated timestamp of the last account modification.
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  @UpdateDateColumn()
  updatedAt: Date;
}
