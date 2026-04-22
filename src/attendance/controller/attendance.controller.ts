import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { AttendanceService } from '../services/attendance.service';
import { CreateAttendanceDto } from '../dto/create-attendance.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserAccount } from '../../users/entities/user.entity';

import { Role } from '../../common/enums/role.enum';

@ApiTags('Attendance')
@ApiBearerAuth('JWT-auth')
@Controller('api/v1/attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {

  constructor(private service: AttendanceService) {}

  @Get()
  @ApiOperation({ summary: 'List attendance records' })
  findAll(@CurrentUser() user: UserAccount, @Query() query: any) {
    return this.service.findAll(user, query);
  }

  @Post()
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Create/Bulk-save attendance record' })
  create(@Body() dto: any, @CurrentUser() user: UserAccount) {
    if (dto.attendance && Array.isArray(dto.attendance)) {
      return this.service.saveBulk(dto, user);
    }
    return this.service.create(dto, user);
  }

  @Get('statistics')
  @Roles(Role.ADMIN, Role.STAFF, Role.STUDENT)
  @ApiOperation({ summary: 'Get attendance statistics' })
  statistics(@CurrentUser() user: UserAccount) {
    return this.service.statistics(user);
  }
}