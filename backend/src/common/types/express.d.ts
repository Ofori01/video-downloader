declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      sessionContext?: {
        id: string;
      };
    }
  }
}

export {};
