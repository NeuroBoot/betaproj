import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attendance } from './entities/attendance.entity';
import { AttendanceController } from './controller/attendance.controller';
import { AttendanceService } from './services/attendance.service';
import { AttendanceRepository } from './repository/attendance.repository';
import { UsersModule } from '../users/users.module';
import { CoursesModule } from '../courses/courses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attendance]),
    UsersModule,
    CoursesModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceRepository],
})
export class AttendanceModule {}