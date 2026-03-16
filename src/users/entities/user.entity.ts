import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Attendance } from '../../attendance/entities/attendance.entity';

@Entity('UserAccount')
export class User {

  @PrimaryGeneratedColumn()
  userAccountId: number;

  @Column()
  username: string;

  @Column()
  password: string;

  @Column()
  userType: string;

  @OneToMany(() => Attendance, attendance => attendance.student)
  attendanceRecords: Attendance[];
}