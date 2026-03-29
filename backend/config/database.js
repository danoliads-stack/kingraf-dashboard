const { Pool } = require('pg');
require('dotenv').config();

// Em produção usa DATABASE_URL (string completa); em dev usa vars separadas
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      { rejectUnauthorized: false },
  // Produção (Vercel): IPv6 para acessar Supabase direto; Dev: IPv4
  family:   isProduction ? 6 : 4,
});

pool.on('connect', () => {
  console.log('✅ Conectado ao PostgreSQL — Kingraf DB');
});

pool.on('error', (err) => {
  console.error('❌ Erro no PostgreSQL:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
