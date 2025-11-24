import { Router } from 'express';
import type { Request, Response } from 'express';
import { searchWeb } from '../services/webSearchService.ts';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

router.post('/web_search', async (req: Request, res: Response) => {
  const { query } = req.body as { query?: string };

  if (!query) {
    return res.status(400).json({ error: 'query is required' });
  }

  try {
    const result = await searchWeb(query);
    res.json(result);
  } catch (error) {
    console.error('[web_search] error:', error);
    res.status(500).json({ error: 'failed to search web' });
  }
});

export default router;
