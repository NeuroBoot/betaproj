import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { UserRepository } from '../repositories/user.repository';
import { UserAccount } from '../entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  async findAll(role?: Role): Promise<Omit<UserAccount, 'password'>[]> {
    let users: UserAccount[];
    if (role) {
      users = await this.userRepository.find({ where: { userType: role, isDeleted: false } });
    } else {
      users = await this.userRepository.find({ where: { isDeleted: false } });
    }
    return users.map(user => {
      const { password, ...result } = user;
      return result;
    });
  }

  async findOne(id: number): Promise<Omit<UserAccount, 'password'>> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    const { password, ...result } = user;
    return result;
  }

  async create(userData: any): Promise<Omit<UserAccount, 'password'>> {
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
    const savedUser = await this.userRepository.save(newUser);
    const { password, ...result } = savedUser;
    return result;
  }

  async update(id: number, userData: Partial<UserAccount>): Promise<Omit<UserAccount, 'password'>> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

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
    const savedUser = await this.userRepository.save(user);
    const { password, ...result } = savedUser;
    return result;
  }

  async remove(id: number): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    user.isDeleted = true;
    await this.userRepository.save(user);
  }
}
