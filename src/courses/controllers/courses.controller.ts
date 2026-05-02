import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CoursesService } from '../services/courses.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { CreateCourseDto } from '../dto/create-course.dto';
import { UpdateCourseDto } from '../dto/update-course.dto';
import { EnrollStudentDto } from '../dto/enroll-student.dto';
import { UserAccount } from '../../users/entities/user.entity';

@ApiTags('Courses')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('courses')
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

  /**
   * NOTE: If you receive a 400 error with "Validation failed (numeric string is expected)", 
   * ensure you are passing a numeric ID in the URL (e.g. /5) and not a literal placeholder like /{5}.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get course details by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: UserAccount) {
    const course = await this.coursesService.findOne(id, user);
    const sectionList = Array.from({ length: course.sections }, (_, i) => i + 1);
    return { ...course, data: { sections: sectionList } };
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Get course details by Code' })
  async findOneByCode(@Param('code') code: string, @CurrentUser() user: UserAccount) {
    const course = await this.coursesService.findOneByCode(code, user);
    const sectionList = Array.from({ length: course.sections }, (_, i) => i + 1);
    return { ...course, data: { sections: sectionList } };
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update course details by ID (Admin only)' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateCourseDto: UpdateCourseDto) {
    return this.coursesService.update(id, updateCourseDto);
  }

  @Put('code/:code')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update course details by Code (Admin only)' })
  async updateByCode(@Param('code') code: string, @Body() updateCourseDto: UpdateCourseDto) {
    return this.coursesService.updateByCode(code, updateCourseDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete course by ID (Admin only). Use ?hard=true for permanent delete.' })
  async remove(@Param('id', ParseIntPipe) id: number, @Query('hard') hard?: string) {
    const isHard = hard === 'true';
    await this.coursesService.remove(id, isHard);
    return { message: `Course ${id} deleted successfully`, type: isHard ? 'hard' : 'soft' };
  }

  @Delete('code/:code')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete course by Code (Admin only). Use ?hard=true for permanent delete.' })
  async removeByCode(@Param('code') code: string, @Query('hard') hard?: string) {
    const isHard = hard === 'true';
    await this.coursesService.removeByCode(code, isHard);
    return { message: `Course ${code} deleted successfully`, type: isHard ? 'hard' : 'soft' };
  }

  @Post(':id/students')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Enroll student in course (Admin/Staff only)' })
  async enrollStudent(
    @Param('id', ParseIntPipe) courseId: number,
    @Body() enrollDto: EnrollStudentDto,
    @CurrentUser() user: UserAccount,
  ) {
    return this.coursesService.enrollStudent(
      courseId, 
      enrollDto.studentId, 
      user, 
      enrollDto.section, 
      enrollDto.lecture
    );
  }

  @Get(':id/students')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'List students in course (Admin/Staff only)' })
  async getEnrolledStudents(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: UserAccount) {
    return this.coursesService.getEnrolledStudents(id, user);
  }
}
