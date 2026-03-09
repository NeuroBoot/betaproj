import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserRepository } from '../../users/repositories/user.repository';
import * as bcrypt from 'bcryptjs';
import { Role } from '../../common/enums/role.enum';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let jwtService: any;

  beforeEach(async () => {
    userRepository = {
      findByUsername: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    jwtService = {
      signAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: userRepository },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw ConflictException if user already exists', async () => {
      userRepository.findByUsername.mockResolvedValue({ username: 'existing' });
      const registerDto = { username: 'existing', password: 'password123' };
      
      await expect(service.register(registerDto as any)).rejects.toThrow(ConflictException);
    });

    it('should register a new user successfully', async () => {
      userRepository.findByUsername.mockResolvedValue(null);
      userRepository.create.mockReturnValue({ username: 'new', password: 'hashed_password', userType: Role.STUDENT });
      userRepository.save.mockResolvedValue({ userAccountId: 1, username: 'new', password: 'hashed_password', userType: Role.STUDENT });
      
      const registerDto = { username: 'new', password: 'password123' };
      const result = await service.register(registerDto as any);
      
      expect(result).toBeDefined();
      expect(result.username).toBe('new');
      expect(result.password).toBeUndefined(); // Password should be hidden
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for invalid credentials', async () => {
      userRepository.findByUsername.mockResolvedValue(null);
      const loginDto = { username: 'wrong', password: 'wrong_password' };
      
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should return access token on successful login', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser = { userAccountId: 1, username: 'user', password: hashedPassword, userType: Role.STUDENT };
      userRepository.findByUsername.mockResolvedValue(mockUser);
      jwtService.signAsync.mockResolvedValue('mock_token');
      
      const loginDto = { username: 'user', password: 'password123' };
      const result = await service.login(loginDto);
      
      expect(result.access_token).toBe('mock_token');
      expect(result.user.username).toBe('user');
    });
  });
});
