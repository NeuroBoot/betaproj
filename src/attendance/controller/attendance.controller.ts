import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards
} from '@nestjs/common';

import { AttendanceService } from '../services/attendance.service';
import { CreateAttendanceDto } from '../dto/create-attendance.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('api/v1/attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {

  constructor(private service: AttendanceService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @Roles('Admin','Staff')
  create(@Body() dto: CreateAttendanceDto) {
    return this.service.create(dto);
  }

  @Get('statistics')
  @Roles('Admin','Staff')
  statistics() {
    return this.service.statistics();
  }
}