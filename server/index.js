import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { FRAMEWORKS, FRAMEWORK_REFERENCES } from './constants.js';
import { changesRouter } from './routes/changes.js';
import { chatRouter } from './routes/chat.js';
import { pdfRouter } from './routes/pdf.js';
import { emailRouter } from './routes/email.js';
import { companiesRouter } from './routes/companies.js';
import { uboRouter } from './routes/ubo.js';
import { analysisRouter } from './routes/analysis.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true }));
app.use(express.json());

app.use('/api/changes', changesRouter);
app.use('/api/chat', chatRouter);
app.use('/api/pdf', pdfRouter);
app.use('/api/email', emailRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/ubo', uboRouter);
app.use('/api/analysis', analysisRouter);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));
app.get('/api/frameworks', (_, res) => res.json({ frameworks: FRAMEWORKS, references: FRAMEWORK_REFERENCES }));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
