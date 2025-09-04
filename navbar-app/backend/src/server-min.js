// Minimal server for Cloud Run sanity check (no Mongo, no extra deps)
import express from 'express';

const app = express();
const port = parseInt(process.env.PORT,10) || 8080;

app.get('/health', (_req,res)=> res.json({ status:'ok', minimal:true, time: Date.now() }));
app.get('/', (_req,res)=> res.json({ service:'navbar-backend-min', ok:true }));

app.listen(port, ()=> {
  console.log(`[minimal] listening on :${port}`);
});
