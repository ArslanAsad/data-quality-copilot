import { Router } from 'express';
import { uploadMiddleware } from '../middleware/upload';
import { uploadCsv, getProfile, analyzeTable, downloadPdf } from '../controllers/uploadController';

const router = Router();

router.post('/upload', uploadMiddleware.single('file'), uploadCsv);
router.get('/profile/:tableId', getProfile);
router.post('/analyze/:tableId', analyzeTable);
router.get('/report/:tableId/pdf', downloadPdf);

export default router;
