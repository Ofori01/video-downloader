declare global {
  namespace Express {
    interface Request {
      sessionContext?: {
        id: string;
      };
    }
  }
}

export {};
