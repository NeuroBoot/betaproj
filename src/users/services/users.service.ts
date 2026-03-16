import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { CreateUserDto } from '../dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  // Create
  create(createUserDto: CreateUserDto) {
    const user = this.usersRepository.create(createUserDto);
    return this.usersRepository.save(user);
  }

  // Get All
  findAll() {
    return this.usersRepository.find();
  }

  // Get One
  findOne(id: number) {
    return this.usersRepository.findOne({
      where: { userAccountId: id },
    });
  }

  // Update
  async update(id: number, data: any) {
    await this.usersRepository.update(id, data);
    return this.findOne(id);
  }

  // Delete
  remove(id: number) {
    return this.usersRepository.delete(id);
  }
}