const db = require('../../config/database');

const migrations = [
  // Usuários
  `CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    perfil VARCHAR(20) DEFAULT 'supervisor' CHECK (perfil IN ('supervisor','diretoria','admin')),
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP DEFAULT NOW(),
    ultimo_acesso TIMESTAMP
  )`,

  // Operadores
  `CREATE TABLE IF NOT EXISTS operadores (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    setor VARCHAR(10) NOT NULL CHECK (setor IN ('opc','ope')),
    ativo BOOLEAN DEFAULT true,
    cargo VARCHAR(50) DEFAULT 'Operador',
    criado_em TIMESTAMP DEFAULT NOW()
  )`,

  // Registros de produtividade
  `CREATE TABLE IF NOT EXISTS producao (
    id SERIAL PRIMARY KEY,
    operador_id INTEGER REFERENCES operadores(id),
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    semana INTEGER CHECK (semana BETWEEN 1 AND 53),
    giros_totais BIGINT DEFAULT 0,
    giros_bons BIGINT DEFAULT 0,
    h_produtivas NUMERIC(10,2) DEFAULT 0,
    h_acerto NUMERIC(10,2) DEFAULT 0,
    h_improdutivas NUMERIC(10,2) DEFAULT 0,
    velocidade_media INTEGER DEFAULT 0,
    qtd_acertos NUMERIC(10,2) DEFAULT 0,
    desperdicio_acerto INTEGER DEFAULT 0,
    desperdicio_virando INTEGER DEFAULT 0,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW(),
    criado_por INTEGER REFERENCES usuarios(id),
    UNIQUE(operador_id, ano, mes)
  )`,

  // Detalhes de horas improdutivas por código
  `CREATE TABLE IF NOT EXISTS horas_improdutivas (
    id SERIAL PRIMARY KEY,
    producao_id INTEGER REFERENCES producao(id) ON DELETE CASCADE,
    codigo VARCHAR(10) NOT NULL,
    descricao VARCHAR(200),
    horas NUMERIC(10,2) DEFAULT 0
  )`,

  // Metas por operador
  `CREATE TABLE IF NOT EXISTS metas (
    id SERIAL PRIMARY KEY,
    operador_id INTEGER REFERENCES operadores(id),
    ano INTEGER NOT NULL,
    meta_hiht NUMERIC(5,2),
    meta_velocidade INTEGER,
    meta_giros BIGINT,
    criado_em TIMESTAMP DEFAULT NOW()
  )`,

  // Alertas gerados automaticamente
  `CREATE TABLE IF NOT EXISTS alertas (
    id SERIAL PRIMARY KEY,
    operador_id INTEGER REFERENCES operadores(id),
    tipo VARCHAR(50),
    mensagem TEXT,
    valor_atual NUMERIC(10,2),
    valor_meta NUMERIC(10,2),
    mes INTEGER,
    ano INTEGER,
    visualizado BOOLEAN DEFAULT false,
    criado_em TIMESTAMP DEFAULT NOW()
  )`,

  // Índices para performance
  `CREATE INDEX IF NOT EXISTS idx_producao_periodo ON producao(ano, mes)`,
  `CREATE INDEX IF NOT EXISTS idx_producao_operador ON producao(operador_id)`,
  `CREATE INDEX IF NOT EXISTS idx_alertas_nao_vistos ON alertas(visualizado) WHERE visualizado = false`,
];

const seedData = async () => {
  // Operadores padrão — Corte e Vinco
  const opsOPC = [
    'Alexandre','Eliel','Euler','Ivan','Jose Jeovane',
    'Josemar','Marcio','Nelson Felix','Renato Weslei','Wellington'
  ];
  const opsOPE = [
    'Danilo Gonçalves','Eder Lussiolli','Emerson de Lima',
    'Jonathan Xavier','José Carlos','Leandro Cys',
    'Mario Geli','Matheus Cassu','Paulo Rogerio','Valdinei Machado'
  ];

  for (const nome of opsOPC) {
    await db.query(
      `INSERT INTO operadores (nome, setor) VALUES ($1, 'opc') ON CONFLICT DO NOTHING`,
      [nome]
    );
  }
  for (const nome of opsOPE) {
    await db.query(
      `INSERT INTO operadores (nome, setor) VALUES ($1, 'ope') ON CONFLICT DO NOTHING`,
      [nome]
    );
  }

  // Usuário padrão supervisor
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('kingraf2026', 10);
  await db.query(`
    INSERT INTO usuarios (nome, email, senha_hash, perfil)
    VALUES
      ('Daniel Oliveira', 'daniel.oliveira@kingraf.com.br', $1, 'supervisor'),
      ('Diretoria', 'diretoria@kingraf.com.br', $1, 'diretoria')
    ON CONFLICT (email) DO NOTHING
  `, [hash]);

  console.log('✅ Dados iniciais inseridos');
};

const runMigrations = async () => {
  console.log('🔄 Rodando migrations...');
  for (const sql of migrations) {
    await db.query(sql);
  }
  console.log('✅ Migrations concluídas');
  await seedData();
  process.exit(0);
};

runMigrations().catch(err => {
  console.error('❌ Erro na migration:', err.message);
  process.exit(1);
});
