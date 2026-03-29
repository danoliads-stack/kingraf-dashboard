const router  = require('express').Router();
const auth    = require('../middleware/auth');
const db      = require('../../config/database');
const ExcelJS = require('exceljs');

const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// GET /api/exportar/excel?ano=2026&mes=1&setor=opc
router.get('/excel', auth, async (req, res) => {
  try {
    const { ano, mes, setor } = req.query;
    const params = [ano];
    let filters = '';
    if (mes)   { filters += ` AND p.mes = $${params.length+1}`;   params.push(mes); }
    if (setor) { filters += ` AND o.setor = $${params.length+1}`; params.push(setor); }

    const { rows } = await db.query(`
      SELECT
        o.nome, o.setor, p.mes, p.ano,
        p.giros_totais, p.giros_bons,
        p.h_produtivas, p.h_acerto, p.h_improdutivas,
        p.velocidade_media, p.qtd_acertos,
        CASE WHEN (p.h_produtivas+p.h_acerto+p.h_improdutivas) > 0
          THEN ROUND(p.h_improdutivas/(p.h_produtivas+p.h_acerto+p.h_improdutivas)*100,2)
          ELSE 0 END AS hiht
      FROM producao p
      JOIN operadores o ON o.id = p.operador_id
      WHERE p.ano = $1 ${filters}
      ORDER BY o.setor, p.mes, o.nome
    `, params);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Kingraf Dashboard';
    wb.created = new Date();

    const ws = wb.addWorksheet('Produtividade', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    // Cabeçalho
    ws.columns = [
      { header: 'Operador',    key: 'nome',            width: 22 },
      { header: 'Setor',       key: 'setor',           width: 14 },
      { header: 'Mês',         key: 'mes',             width: 12 },
      { header: 'Ano',         key: 'ano',             width: 8  },
      { header: 'Giros Totais',key: 'giros_totais',    width: 14 },
      { header: 'Giros Bons',  key: 'giros_bons',      width: 12 },
      { header: 'H. Produtivas',key:'h_produtivas',    width: 14 },
      { header: 'H. Acerto',   key: 'h_acerto',        width: 12 },
      { header: 'H. Improd.',  key: 'h_improdutivas',  width: 12 },
      { header: 'Vel. Média',  key: 'velocidade_media',width: 12 },
      { header: 'Qtd. Acertos',key: 'qtd_acertos',     width: 13 },
      { header: 'Hi/Ht %',     key: 'hiht',            width: 10 },
    ];

    // Estilo do cabeçalho
    ws.getRow(1).eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A1A' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    ws.getRow(1).height = 22;

    // Dados
    rows.forEach((r, i) => {
      const row = ws.addRow({
        ...r,
        setor: r.setor === 'opc' ? 'Corte e Vinco' : 'Colagem',
        mes: MESES[r.mes],
      });

      // Cor alternada
      if (i % 2 === 0) {
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F4' } };
        });
      }

      // Colorir Hi/Ht
      const hihtCell = row.getCell('hiht');
      const hiht = Number(r.hiht);
      hihtCell.font = { bold: true, color: { argb: hiht > 45 ? 'FFE24B4A' : hiht > 30 ? 'FFBA7517' : 'FF1D9E75' } };
    });

    // Bordas
    ws.eachRow(row => {
      row.eachCell(cell => {
        cell.border = {
          top:    { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left:   { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right:  { style: 'thin', color: { argb: 'FFE0E0E0' } },
        };
      });
    });

    const periodo = mes ? `${MESES[mes]}_${ano}` : `Ano_${ano}`;
    const filename = `Kingraf_Produtividade_${periodo}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
