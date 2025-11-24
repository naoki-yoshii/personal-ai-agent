import express from 'express';
import cors from 'cors';
import webSearchRouter from './routes/webSearchRoute.ts';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/', webSearchRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3002;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`mcp-web-search server is running on port ${PORT}`);
});
