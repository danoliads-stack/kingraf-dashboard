require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const express = require('express');
const cors    = require('cors');
const app     = express();

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL,
].filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotas
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/operadores', require('./routes/operadores'));
app.use('/api/producao',   require('./routes/producao'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/exportar',   require('./routes/exportar'));
app.use('/api/alertas',    require('./routes/alertas'));
app.use('/api/importar',   require('./routes/importar'));

app.get('/api/health', (_, res) => res.json({ status: 'ok', sistema: 'Kingraf Dashboard' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Kingraf API rodando em http://localhost:${PORT}`);
  console.log(`📊 Dashboard em       http://localhost:5173\n`);
});
