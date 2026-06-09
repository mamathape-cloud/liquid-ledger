export interface UserRole {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  role: UserRole;
  mustChangePassword: boolean;
  isDeleted: boolean;
  createdAt: string;
}
