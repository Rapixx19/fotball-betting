import { User as DbUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      password: string;
      createdAt: Date;
    }
  }
}

export {};
