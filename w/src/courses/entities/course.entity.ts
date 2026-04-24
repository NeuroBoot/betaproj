import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { UserAccount } from '../../users/entities/user.entity';
import { Attendance } from '../../attendance/entities/attendance.entity';

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

  // 🔹 إضافة جدول المحاضرات (المواعيد)
  @Column({ nullable: true })
  schedule: string; // e.g., "Sun, Tue 10:00-12:00"

  // 🔹 رقم القاعة
  @Column({ nullable: true })
  room: string; // e.g., "Hall A-101"

  // 🔹 عدد الساعات المعتمدة
  @Column({ default: 3 })
  credits: number;

  @ManyToOne(() => UserAccount)
  admin: UserAccount;

  @ManyToOne(() => UserAccount)
  instructor: UserAccount;

  @ManyToMany(() => UserAccount)
  @JoinTable({
    name: 'course_enrollments',
    joinColumn: { name: 'courseId', referencedColumnName: 'courseId' },
    inverseJoinColumn: { name: 'userAccountId', referencedColumnName: 'userAccountId' },
  })
  students: UserAccount[];

  @OneToMany(() => Attendance, (attendance) => attendance.course)
  attendanceRecords: Attendance[];

  @Column({ default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}