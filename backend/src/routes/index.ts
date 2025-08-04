import { Router } from 'express';
import { getStatus } from '../controllers';

const router = Router();

router.get('/status', getStatus);

export default router;
