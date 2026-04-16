import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from './entities/course.entity';
import { CourseRepository } from './repositories/course.repository';
import { CoursesService } from './services/courses.service';
import { CoursesController } from './controllers/courses.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Course]),
    UsersModule,
  ],
  controllers: [CoursesController],
  providers: [CourseRepository, CoursesService],
  exports: [CourseRepository, CoursesService],
})
export class CoursesModule {}
