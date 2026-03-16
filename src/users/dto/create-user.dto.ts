export class CreateUserDto {
  username: string;
  password: string;
  userType: 'Admin' | 'Staff' | 'Student';
}