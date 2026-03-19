import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { AttendanceModule } from './attendance/attendance.module';
import { UserAccount } from './users/entities/user.entity';
import { Course } from './courses/entities/course.entity';
import { Attendance } from './attendance/entities/attendance.entity';
import { validate } from './common/config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME', 'root'),
        password: configService.get<string>('DB_PASSWORD', 'yourpassword'),
        database: configService.get<string>('DB_NAME', 'facemark'),
        entities: [UserAccount, Course, Attendance],
        synchronize: configService.get<boolean>('DB_SYNCHRONIZE', true), // Read from config
      }),
    }),
    AuthModule,
    UsersModule,
    CoursesModule,
    AttendanceModule,
  ],
})
export class AppModule {}
