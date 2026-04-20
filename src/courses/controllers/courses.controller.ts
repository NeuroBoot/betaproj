import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CoursesService } from '../services/courses.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { CreateCourseDto } from '../dto/create-course.dto';
import { UpdateCourseDto } from '../dto/update-course.dto';
import { UserAccount } from '../../users/entities/user.entity';

@ApiTags('Courses')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ApiOperation({ summary: 'List all active courses' })
  async findAll(@CurrentUser() user: UserAccount) {
    return this.coursesService.findAll(user);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create course (Admin only)' })
  @ApiResponse({ status: 201, description: 'Course created' })
  async create(@Body() createCourseDto: CreateCourseDto, @CurrentUser() admin: UserAccount) {
    return this.coursesService.create(createCourseDto, admin);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get course details' })
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: UserAccount) {
    return this.coursesService.findOne(id, user);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update course details (Admin only)' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateCourseDto: UpdateCourseDto) {
    return this.coursesService.update(id, updateCourseDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete course (Admin only)' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.coursesService.remove(id);
  }

  @Post(':id/students')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Enroll student in course (Admin/Staff only)' })
  async enrollStudent(
    @Param('id', ParseIntPipe) courseId: number,
    @Body('studentId', ParseIntPipe) studentId: number,
  ) {
    return this.coursesService.enrollStudent(courseId, studentId);
  }

  @Get(':id/students')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'List students in course (Admin/Staff only)' })
  async getEnrolledStudents(@Param('id', ParseIntPipe) id: number) {
    return this.coursesService.getEnrolledStudents(id);
  }
}
