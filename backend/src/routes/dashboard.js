const router = require('express').Router();
const auth   = require('../middleware/auth');
const db     = require('../../config/database');

// GET /api/dashboard/resumo?ano=2026&mes=1
router.get('/resumo', auth, async (req, res) => {
  try {
    const { ano, mes } = req.query;
    const params = [ano];
    let mesFilter = '';
    if (mes) { mesFilter = `AND p.mes = $2`; params.push(mes); }

    const { rows } = await db.query(`
      SELECT
        o.setor,
        SUM(p.giros_totais)    AS giros_totais,
        SUM(p.giros_bons)      AS giros_bons,
        SUM(p.h_produtivas)    AS h_produtivas,
        SUM(p.h_acerto)        AS h_acerto,
        SUM(p.h_improdutivas)  AS h_improdutivas,
        AVG(p.velocidade_media)AS velocidade_media,
        SUM(p.qtd_acertos)     AS qtd_acertos,
        COUNT(DISTINCT p.operador_id) AS num_operadores
      FROM producao p
      JOIN operadores o ON o.id = p.operador_id
      WHERE p.ano = $1 ${mesFilter}
      GROUP BY o.setor
    `, params);

    res.json(rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// GET /api/dashboard/ranking?ano=2026&mes=1&setor=opc
router.get('/ranking', auth, async (req, res) => {
  try {
    const { ano, mes, setor } = req.query;
    const params = [ano];
    let filters = '';
    if (mes)   { filters += ` AND p.mes = $${params.length+1}`;   params.push(mes); }
    if (setor) { filters += ` AND o.setor = $${params.length+1}`; params.push(setor); }

    const { rows } = await db.query(`
      SELECT
        o.id, o.nome, o.setor,
        SUM(p.giros_totais)   AS giros_totais,
        SUM(p.h_produtivas)   AS h_produtivas,
        SUM(p.h_acerto)       AS h_acerto,
        SUM(p.h_improdutivas) AS h_improdutivas,
        AVG(p.velocidade_media) AS velocidade_media,
        SUM(p.qtd_acertos)    AS qtd_acertos,
        CASE
          WHEN SUM(p.h_produtivas+p.h_acerto+p.h_improdutivas) > 0
          THEN ROUND(SUM(p.h_improdutivas) / SUM(p.h_produtivas+p.h_acerto+p.h_improdutivas) * 100, 2)
          ELSE 0
        END AS hiht,
        CASE
          WHEN SUM(p.qtd_acertos) > 0
          THEN ROUND(SUM(p.h_acerto) / SUM(p.qtd_acertos), 2)
          ELSE 0
        END AS h_por_acerto
      FROM producao p
      JOIN operadores o ON o.id = p.operador_id
      WHERE p.ano = $1 ${filters} AND o.ativo = true
      GROUP BY o.id, o.nome, o.setor
      ORDER BY giros_totais DESC
    `, params);

    // Calcula pontuação combinada
    const maxGiros = Math.max(...rows.map(r => Number(r.giros_totais) || 0), 1);
    const maxVel   = Math.max(...rows.map(r => Number(r.velocidade_media) || 0), 1);
    const maxHAc   = Math.max(...rows.map(r => Number(r.h_por_acerto) || 0), 1);

    const ranked = rows.map(r => {
      const sG = Number(r.giros_totais) / maxGiros;
      const sV = Number(r.velocidade_media) / maxVel;
      const sA = 1 - (Math.min(Number(r.h_por_acerto), maxHAc) / maxHAc);
      const score = (sG * 0.40 + sV * 0.35 + sA * 0.25) * 100;
      return { ...r, score: Math.round(score * 10) / 10 };
    }).sort((a, b) => b.score - a.score)
      .map((r, i) => ({ ...r, posicao: i + 1 }));

    res.json(ranked);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// GET /api/dashboard/evolucao?ano=2026&setor=opc
router.get('/evolucao', auth, async (req, res) => {
  try {
    const { ano, setor } = req.query;
    const params = [ano];
    let sFilter = '';
    if (setor) { sFilter = ` AND o.setor = $2`; params.push(setor); }

    const { rows } = await db.query(`
      SELECT
        p.mes,
        SUM(p.giros_totais)   AS giros_totais,
        SUM(p.h_produtivas)   AS h_produtivas,
        SUM(p.h_acerto)       AS h_acerto,
        SUM(p.h_improdutivas) AS h_improdutivas,
        CASE
          WHEN SUM(p.h_produtivas+p.h_acerto+p.h_improdutivas) > 0
          THEN ROUND(SUM(p.h_improdutivas) / SUM(p.h_produtivas+p.h_acerto+p.h_improdutivas) * 100, 2)
          ELSE 0
        END AS hiht
      FROM producao p
      JOIN operadores o ON o.id = p.operador_id
      WHERE p.ano = $1 ${sFilter}
      GROUP BY p.mes
      ORDER BY p.mes
    `, params);

    res.json(rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// GET /api/dashboard/improdutivo-codigos?ano=2026&mes=1
router.get('/improdutivo-codigos', auth, async (req, res) => {
  try {
    const { ano, mes, setor } = req.query;
    const params = [ano];
    let filters = '';
    if (mes)   { filters += ` AND p.mes = $${params.length+1}`;   params.push(mes); }
    if (setor) { filters += ` AND o.setor = $${params.length+1}`; params.push(setor); }

    const { rows } = await db.query(`
      SELECT
        hi.codigo,
        hi.descricao,
        SUM(hi.horas) AS total_horas
      FROM horas_improdutivas hi
      JOIN producao p ON p.id = hi.producao_id
      JOIN operadores o ON o.id = p.operador_id
      WHERE p.ano = $1 ${filters}
      GROUP BY hi.codigo, hi.descricao
      ORDER BY total_horas DESC
    `, params);

    res.json(rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// GET /api/dashboard/total-anual?ano=2025
router.get('/total-anual', auth, async (req, res) => {
  try {
    const { ano, setor } = req.query;
    const params = [ano];
    let sFilter = '';
    if (setor) { sFilter = ` AND o.setor = $2`; params.push(setor); }

    const { rows } = await db.query(`
      SELECT
        o.id, o.nome, o.setor,
        SUM(p.giros_totais)    AS giros_totais,
        SUM(p.giros_bons)      AS giros_bons,
        SUM(p.h_produtivas)    AS h_produtivas,
        SUM(p.h_acerto)        AS h_acerto,
        SUM(p.h_improdutivas)  AS h_improdutivas,
        AVG(p.velocidade_media)AS velocidade_media,
        SUM(p.qtd_acertos)     AS qtd_acertos,
        SUM(p.desperdicio_acerto)   AS desperdicio_acerto,
        SUM(p.desperdicio_virando)  AS desperdicio_virando,
        COUNT(p.id)            AS meses_com_dados,
        CASE
          WHEN SUM(p.h_produtivas+p.h_acerto+p.h_improdutivas) > 0
          THEN ROUND(SUM(p.h_improdutivas) / SUM(p.h_produtivas+p.h_acerto+p.h_improdutivas) * 100, 2)
          ELSE 0
        END AS hiht
      FROM producao p
      JOIN operadores o ON o.id = p.operador_id
      WHERE p.ano = $1 ${sFilter} AND o.ativo = true
      GROUP BY o.id, o.nome, o.setor
      ORDER BY giros_totais DESC
    `, params);

    res.json(rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// GET /api/dashboard/operador/:id?ano=2025
router.get('/operador/:id', auth, async (req, res) => {
  try {
    const { ano } = req.query;
    const opId = req.params.id;

    // Dados do operador
    const { rows: [operador] } = await db.query(
      `SELECT id, nome, setor FROM operadores WHERE id = $1`, [opId]
    );
    if (!operador) return res.status(404).json({ erro: 'Operador não encontrado' });

    // Dados mensais
    const { rows: meses } = await db.query(`
      SELECT
        p.mes,
        p.giros_totais, p.giros_bons,
        p.h_produtivas, p.h_acerto, p.h_improdutivas,
        p.velocidade_media, p.qtd_acertos,
        p.desperdicio_acerto, p.desperdicio_virando,
        CASE
          WHEN (p.h_produtivas+p.h_acerto+p.h_improdutivas) > 0
          THEN ROUND(p.h_improdutivas / (p.h_produtivas+p.h_acerto+p.h_improdutivas) * 100, 2)
          ELSE 0
        END AS hiht
      FROM producao p
      WHERE p.operador_id = $1 AND p.ano = $2
      ORDER BY p.mes
    `, [opId, ano]);

    // Horas improdutivas por código (ano todo)
    const { rows: codigos } = await db.query(`
      SELECT hi.codigo, hi.descricao, SUM(hi.horas) AS total_horas
      FROM horas_improdutivas hi
      JOIN producao p ON p.id = hi.producao_id
      WHERE p.operador_id = $1 AND p.ano = $2
      GROUP BY hi.codigo, hi.descricao
      ORDER BY total_horas DESC
    `, [opId, ano]);

    res.json({ operador, meses, codigos });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
