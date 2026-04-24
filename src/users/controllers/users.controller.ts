import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { UserAccount } from '../entities/user.entity';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users (Admin only)' })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  async findAll(@Query('role') role?: Role) {
    return this.usersService.findAll(role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user details by ID (Admin only)' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Get('username/:username')
  @ApiOperation({ summary: 'Get user details by Username (Admin only)' })
  async findOneByUsername(@Param('username') username: string) {
    return this.usersService.findOneByUsername(username);
  }

  @Post()
  @ApiOperation({ summary: 'Create new user (Admin only)' })
  @ApiResponse({ status: 201, description: 'User created' })
  async create(@Body() userData: Partial<UserAccount>) {
    return this.usersService.create(userData);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user by ID (Admin only)' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() userData: Partial<UserAccount>) {
    return this.usersService.update(id, userData);
  }

  @Put('username/:username')
  @ApiOperation({ summary: 'Update user by Username (Admin only)' })
  async updateByUsername(@Param('username') username: string, @Body() userData: Partial<UserAccount>) {
    return this.usersService.updateByUsername(username, userData);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user by ID (Admin only). Use ?hard=true for permanent delete.' })
  async remove(@Param('id', ParseIntPipe) id: number, @Query('hard') hard?: string) {
    const isHard = hard === 'true';
    return this.usersService.remove(id, isHard);
  }

  @Delete('username/:username')
  @ApiOperation({ summary: 'Delete user by username (Admin only). Use ?hard=true for permanent delete.' })
  async removeByUsername(@Param('username') username: string, @Query('hard') hard?: string) {
    const isHard = hard === 'true';
    return this.usersService.removeByUsername(username, isHard);
  }
}
