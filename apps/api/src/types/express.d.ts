declare global {
  namespace Express {
    interface Request {
      planUserId?: string;
    }
  }
}

export {};
