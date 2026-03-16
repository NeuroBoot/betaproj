export class UpdateUserDto {
  username?: string;
  password?: string;
  userType?: 'Admin' | 'Staff' | 'Student';
}