const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../../config/database');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    const { rows } = await db.query(
      'SELECT * FROM usuarios WHERE email = $1 AND ativo = true', [email]
    );
    if (!rows.length) return res.status(401).json({ erro: 'Usuário ou senha inválidos' });

    const usuario = rows[0];
    const ok = await bcrypt.compare(senha, usuario.senha_hash);
    if (!ok) return res.status(401).json({ erro: 'Usuário ou senha inválidos' });

    await db.query('UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = $1', [usuario.id]);

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil } });
  } catch (err) {
    console.error('❌ Erro no login:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/auth/alterar-senha
router.post('/alterar-senha', require('../middleware/auth'), async (req, res) => {
  try {
    const { senha_atual, nova_senha } = req.body;
    const { rows } = await db.query('SELECT * FROM usuarios WHERE id = $1', [req.usuario.id]);
    const ok = await bcrypt.compare(senha_atual, rows[0].senha_hash);
    if (!ok) return res.status(401).json({ erro: 'Senha atual incorreta' });
    const hash = await bcrypt.hash(nova_senha, 10);
    await db.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [hash, req.usuario.id]);
    res.json({ mensagem: 'Senha alterada com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
