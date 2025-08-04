import { Request, Response } from 'express';

export const getStatus = (_req: Request, res: Response) => {
  res.json({ status: '后端服务正常运行' });
};
