import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import uploadRoutes from './routes/upload';
import { logger } from './utils/logger';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api', uploadRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'data-quality-copilot' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
