import { Router } from 'express';
import { analyzeCv, getAnalysis, getHistory, uploadMiddleware, generateSummary, generateCoverLetter, updateCoverLetter, generateInterview } from '../controllers/analysis.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.post('/', uploadMiddleware, analyzeCv);
router.get('/history', getHistory);
router.get('/:id', getAnalysis);
router.post('/:id/generate-summary', generateSummary);
router.post('/:id/generate-cover-letter', generateCoverLetter);
router.put('/:id/cover-letter', updateCoverLetter);
router.post('/:id/generate-interview', generateInterview);

export default router;
