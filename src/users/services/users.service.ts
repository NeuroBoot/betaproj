import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { UserRepository } from '../repositories/user.repository';
import { UserAccount } from '../entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  async findAll(role?: Role): Promise<UserAccount[]> {
    if (role) {
      return this.userRepository.find({ where: { userType: role, isDeleted: false } });
    }
    return this.userRepository.find({ where: { isDeleted: false } });
  }

  async findOne(id: number): Promise<UserAccount> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async create(userData: any): Promise<UserAccount> {
    const existingUser = await this.userRepository.findByUsername(userData.username);
    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    // Handle 'role' alias for 'userType' if provided
    if (userData.role && !userData.userType) {
      userData.userType = userData.role;
    }

    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }

    const newUser: UserAccount = this.userRepository.create(userData as UserAccount);
    return this.userRepository.save(newUser);
  }

  async update(id: number, userData: Partial<UserAccount>): Promise<UserAccount> {
    const user = await this.findOne(id);

    if (userData.username && userData.username !== user.username) {
      const existingUser = await this.userRepository.findByUsername(userData.username);
      if (existingUser) {
        throw new ConflictException('Username already exists');
      }
    }

    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }

    Object.assign(user, userData);
    return this.userRepository.save(user);
  }

  async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    user.isDeleted = true;
    await this.userRepository.save(user);
  }
}
