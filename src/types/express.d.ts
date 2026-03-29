declare global {
  namespace Express {
    interface Request {
      /** Set by request-id middleware. */
      requestId: string;
    }
  }
}

export {};
