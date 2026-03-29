const router = require('express').Router();
const auth   = require('../middleware/auth');
const db     = require('../../config/database');

router.get('/', auth, async (req, res) => {
  try {
    const { setor } = req.query;
    let sql = 'SELECT * FROM operadores WHERE ativo = true';
    const params = [];
    if (setor) { sql += ' AND setor = $1'; params.push(setor); }
    sql += ' ORDER BY setor, nome';
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { nome, setor, cargo } = req.body;
    const { rows } = await db.query(
      'INSERT INTO operadores (nome, setor, cargo) VALUES ($1, $2, $3) RETURNING *',
      [nome, setor, cargo || 'Operador']
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.patch('/:id/desativar', auth, async (req, res) => {
  try {
    await db.query('UPDATE operadores SET ativo = false WHERE id = $1', [req.params.id]);
    res.json({ mensagem: 'Operador desativado' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
