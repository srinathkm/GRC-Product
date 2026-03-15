import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { FRAMEWORKS, FRAMEWORK_REFERENCES } from './constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
import { changesRouter } from './routes/changes.js';
import { authRouter } from './routes/auth.js';
import { chatRouter } from './routes/chat.js';
import { pdfRouter } from './routes/pdf.js';
import { emailRouter } from './routes/email.js';
import { companiesRouter } from './routes/companies.js';
import { uboRouter } from './routes/ubo.js';
import { analysisRouter } from './routes/analysis.js';
import { poaRouter } from './routes/poa.js';
import { ipRouter } from './routes/ip.js';
import { licencesRouter } from './routes/licences.js';
import { litigationsRouter } from './routes/litigations.js';
import { contractsRouter } from './routes/contracts.js';
import { governanceRouter } from './routes/governance.js';
import { defenderIntegrationRouter } from './routes/defenderIntegration.js';
import { dataSovereigntyRouter } from './routes/dataSovereignty.js';
import { dashboardRouter } from './routes/dashboard.js';
import { auditRouter } from './routes/audit.js';
import { tasksRouter } from './routes/tasks.js';
import { fieldMappingsRouter } from './routes/fieldMappings.js';
import { esgRouter } from './routes/esg.js';
import { extractRouter } from './routes/extract.js';
import { assistantRouter } from './routes/assistant.js';
import { boardPackRouter } from './routes/boardpack.js';
import { startFeedScheduler } from './services/regulatoryFeed.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/changes', changesRouter);
app.use('/api/chat', chatRouter);
app.use('/api/pdf', pdfRouter);
app.use('/api/email', emailRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/ubo', uboRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/governance', governanceRouter);
app.use('/api/poa', poaRouter);
app.use('/api/ip', ipRouter);
app.use('/api/licences', licencesRouter);
app.use('/api/litigations', litigationsRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/defender', defenderIntegrationRouter);
app.use('/api/data-sovereignty', dataSovereigntyRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/audit', auditRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/field-mappings', fieldMappingsRouter);
app.use('/api/esg', esgRouter);
app.use('/api/extract', extractRouter);
app.use('/api/assistant', assistantRouter);
app.use('/api/board-pack', boardPackRouter);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));
app.get('/api/frameworks', (_, res) => res.json({ frameworks: FRAMEWORKS, references: FRAMEWORK_REFERENCES }));

// Serve built client (when running in Docker or with client/dist copied to server/public)
app.use(express.static(join(__dirname, 'public')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

const bind = process.env.BIND || '127.0.0.1';
app.listen(PORT, bind, () => {
  console.log(`Server running at http://${bind}:${PORT}`);
  startFeedScheduler();
});
