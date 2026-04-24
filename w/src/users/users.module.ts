import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAccount } from './entities/user.entity';
import { Alert } from './entities/alert.entity';
import { UserRepository } from './repositories/user.repository';
import { UsersService } from './services/users.service';
import { AlertsService } from './services/alerts.service';
import { UsersController } from './controllers/users.controller';
import { AlertsController } from './controllers/alerts.controller';
import { AttendanceModule } from '../attendance/attendance.module';
import { CoursesModule } from '../courses/courses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserAccount, Alert]),
    forwardRef(() => AttendanceModule),
    forwardRef(() => CoursesModule),
  ],
  controllers: [UsersController, AlertsController],
  providers: [UserRepository, UsersService, AlertsService],
  exports: [UserRepository, UsersService, AlertsService],  
})
export class UsersModule {}