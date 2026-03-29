const router = require('express').Router();
const auth   = require('../middleware/auth');
const db     = require('../../config/database');

// GET /api/producao?ano=2026&mes=1&setor=opc
router.get('/', auth, async (req, res) => {
  try {
    const { ano, mes, setor } = req.query;
    let sql = `
      SELECT p.*, o.nome as operador_nome, o.setor
      FROM producao p
      JOIN operadores o ON o.id = p.operador_id
      WHERE p.ano = $1
    `;
    const params = [ano];
    if (mes)   { sql += ` AND p.mes = $${params.length+1}`;   params.push(mes); }
    if (setor) { sql += ` AND o.setor = $${params.length+1}`; params.push(setor); }
    sql += ` ORDER BY o.nome`;
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// POST /api/producao — salvar ou atualizar registro
router.post('/', auth, async (req, res) => {
  try {
    const {
      operador_id, ano, mes,
      giros_totais, giros_bons,
      h_produtivas, h_acerto, h_improdutivas,
      velocidade_media, qtd_acertos,
      desperdicio_acerto, desperdicio_virando,
      horas_improdutivas_detalhe
    } = req.body;

    // Upsert produção
    const { rows } = await db.query(`
      INSERT INTO producao (
        operador_id, ano, mes,
        giros_totais, giros_bons,
        h_produtivas, h_acerto, h_improdutivas,
        velocidade_media, qtd_acertos,
        desperdicio_acerto, desperdicio_virando,
        criado_por, atualizado_em
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
      ON CONFLICT (operador_id, ano, mes) DO UPDATE SET
        giros_totais = EXCLUDED.giros_totais,
        giros_bons   = EXCLUDED.giros_bons,
        h_produtivas = EXCLUDED.h_produtivas,
        h_acerto     = EXCLUDED.h_acerto,
        h_improdutivas = EXCLUDED.h_improdutivas,
        velocidade_media = EXCLUDED.velocidade_media,
        qtd_acertos  = EXCLUDED.qtd_acertos,
        desperdicio_acerto = EXCLUDED.desperdicio_acerto,
        desperdicio_virando = EXCLUDED.desperdicio_virando,
        atualizado_em = NOW()
      RETURNING *
    `, [operador_id, ano, mes,
        giros_totais||0, giros_bons||0,
        h_produtivas||0, h_acerto||0, h_improdutivas||0,
        velocidade_media||0, qtd_acertos||0,
        desperdicio_acerto||0, desperdicio_virando||0,
        req.usuario.id]);

    const prod = rows[0];

    // Salva detalhes de horas improdutivas por código
    if (horas_improdutivas_detalhe?.length) {
      await db.query('DELETE FROM horas_improdutivas WHERE producao_id = $1', [prod.id]);
      for (const hi of horas_improdutivas_detalhe) {
        await db.query(`
          INSERT INTO horas_improdutivas (producao_id, codigo, descricao, horas)
          VALUES ($1, $2, $3, $4)
        `, [prod.id, hi.codigo, hi.descricao, hi.horas]);
      }
    }

    // Verifica alertas
    await verificarAlertas(prod, operador_id);

    res.json({ mensagem: 'Registro salvo', producao: prod });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// DELETE /api/producao/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM producao WHERE id = $1', [req.params.id]);
    res.json({ mensagem: 'Registro removido' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

async function verificarAlertas(prod, operador_id) {
  const tot = parseFloat(prod.h_produtivas) + parseFloat(prod.h_acerto) + parseFloat(prod.h_improdutivas);
  if (tot === 0) return;
  const hiht = (parseFloat(prod.h_improdutivas) / tot) * 100;

  const { rows: op } = await db.query('SELECT setor FROM operadores WHERE id = $1', [operador_id]);
  const limite = op[0]?.setor === 'opc' ? 45 : 75;

  if (hiht > limite) {
    await db.query(`
      INSERT INTO alertas (operador_id, tipo, mensagem, valor_atual, valor_meta, mes, ano)
      VALUES ($1, 'hiht_alto', $2, $3, $4, $5, $6)
    `, [operador_id,
        `Hi/Ht em ${hiht.toFixed(1)}% — acima do limite de ${limite}%`,
        hiht, limite, prod.mes, prod.ano]);
  }
}

module.exports = router;
