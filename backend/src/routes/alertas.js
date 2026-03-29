const router = require('express').Router();
const auth   = require('../middleware/auth');
const db     = require('../../config/database');

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT a.*, o.nome as operador_nome, o.setor
      FROM alertas a
      JOIN operadores o ON o.id = a.operador_id
      WHERE a.visualizado = false
      ORDER BY a.criado_em DESC
      LIMIT 50
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.patch('/:id/visualizar', auth, async (req, res) => {
  try {
    await db.query('UPDATE alertas SET visualizado = true WHERE id = $1', [req.params.id]);
    res.json({ mensagem: 'Alerta marcado como visto' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
