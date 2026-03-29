const router  = require('express').Router();
const auth    = require('../middleware/auth');
const db      = require('../../config/database');
const multer  = require('multer');
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

const MONTH_MAP = { jan:1, fev:2, mar:3, abr:4, mai:5, jun:6, jul:7, ago:8, set:9, out:10, nov:11, dez:12 };

// Converte número no formato brasileiro
function parseBR(str) {
  if (!str || str === '-' || str === '') return 0;
  str = String(str).replace(/%/g, '').trim();
  if (!str) return 0;
  // Formato ",31" → 0.31
  if (str.startsWith(',')) str = '0' + str;
  // Remove separador de milhar e converte vírgula decimal
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else {
    // "895.460" → 895460 (separador de milhar)
    if (/^\d{1,3}(\.\d{3})+$/.test(str)) str = str.replace(/\./g, '');
  }
  return parseFloat(str) || 0;
}

// Agrupa items PDF por linha (tolerância Y)
function groupByRow(items, tol = 4) {
  const rows = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    const y = item.transform[5];
    const x = item.transform[4];
    let found = false;
    for (const row of rows) {
      if (Math.abs(row.y - y) <= tol) {
        row.cells.push({ x, str: item.str.trim() });
        found = true;
        break;
      }
    }
    if (!found) rows.push({ y, cells: [{ x, str: item.str.trim() }] });
  }
  // Ordena da esquerda para direita dentro de cada linha
  for (const row of rows) row.cells.sort((a, b) => a.x - b.x);
  // Ordena de cima para baixo (Y maior = mais alto na página PDF)
  return rows.sort((a, b) => b.y - a.y);
}

// Atribui células a colunas baseado em posição X
// Usa "maior cabeçalho <= x da célula" — robusto contra valores deslocados à direita no PDF
function assignColumns(cells, colXs) {
  const result = new Array(colXs.length).fill(null);
  for (const cell of cells) {
    // encontra o índice do maior colX que seja <= cell.x
    let idx = -1;
    for (let i = 0; i < colXs.length; i++) {
      if (colXs[i] <= cell.x + 5) idx = i;
    }
    if (idx >= 0 && result[idx] === null) result[idx] = cell.str;
  }
  return result;
}

async function parsePDFBuffer(buffer) {
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  const data = new Uint8Array(buffer);
  const doc  = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;

  const operadores = {}; // { nome: { ano, meses: { mes: { ... } } } }

  for (let p = 1; p <= doc.numPages; p++) {
    const page    = await doc.getPage(p);
    const content = await page.getTextContent();
    const rows    = groupByRow(content.items);

    // Detecta linha com meses (jan/YYYY, fev/YYYY, ...)
    let monthRow = null;
    for (const row of rows) {
      const text = row.cells.map(c => c.str).join(' ');
      if (/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/\d{4}/i.test(text)) {
        monthRow = row;
        break;
      }
    }
    if (!monthRow) continue;

    // Extrai meses e seus X (remove espaços pois PDF pode gerar "fev /2025")
    const months = []; // [{ mes, ano, x }]
    for (const cell of monthRow.cells) {
      const clean = cell.str.replace(/\s+/g, '');
      const m = clean.match(/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/(\d{4})$/i);
      if (m) months.push({ mes: MONTH_MAP[m[1].toLowerCase()], ano: parseInt(m[2]), x: cell.x });
    }
    if (!months.length) continue;

    // Coluna "Total" (última coluna de dados)
    const totalCell = monthRow.cells.find(c => c.str.toLowerCase() === 'total');
    const colXs = months.map(m => m.x);
    if (totalCell) colXs.push(totalCell.x); // última coluna = Total

    const ano = months[0].ano;

    // Detecta nome do operador (procura acima e abaixo da linha de meses)
    let operadorNome = null;
    const monthRowIdx = rows.indexOf(monthRow);
    // Labels de métricas que nunca são nomes de operadores (normalizado sem espaços)
    const isMetricLabel = t => {
      const n = t.replace(/\s+/g, '').toLowerCase();
      // contém padrão numérico (dados de meses) → não é nome de operador
      if (/\d+[.,]\d+/.test(t) || /\s\d{2,}/.test(t)) return true;
      return /^(girostotais|girosbons|giros\/|h\.prod|h\.acerto|h\.improd|horas|total|desper|velocid|veloc|qtdacertos|media|hivsht|giros\/htot|giros\/entrada|atividade|ativos|indicadores|emitido|pagina|metrics|produtividade)/.test(n);
    };

    // Procura primeiro ACIMA da linha de meses (índice menor = Y maior)
    for (let i = monthRowIdx - 1; i >= 0; i--) {
      const text = rows[i].cells.map(c => c.str).join(' ').trim();
      if (!text || isMetricLabel(text)) continue;
      if (/^[A-ZÀ-Ú]/i.test(text) && !/^\d/.test(text)) {
        operadorNome = text
          .replace(/Emitido por:.*/i, '')
          .replace(/Página:.*/i, '')
          .replace(/Metrics PCP.*/i, '')
          .trim();
        if (operadorNome) break;
      }
    }
    // Se não achou acima, procura ABAIXO
    if (!operadorNome) {
      for (let i = monthRowIdx + 1; i < rows.length; i++) {
        const text = rows[i].cells.map(c => c.str).join(' ').trim();
        if (!text || isMetricLabel(text)) continue;
        if (/^[A-ZÀ-Ú]/i.test(text) && !/^\d/.test(text)) {
          operadorNome = text
            .replace(/Emitido por:.*/i, '')
            .replace(/Página:.*/i, '')
            .trim();
          if (operadorNome) break;
        }
      }
    }
    if (!operadorNome || /^total$/i.test(operadorNome)) continue;

    if (!operadores[operadorNome]) operadores[operadorNome] = { ano, meses: {} };

    // Função para pegar row de dados pelo label
    // pdfjs-dist pode quebrar palavras com espaços extras, então normalizamos
    function getRowValues(labelPattern) {
      for (const row of rows) {
        const labels = row.cells.filter(c => c.x < (colXs[0] - 5));
        const label  = labels.map(c => c.str).join('').replace(/\s+/g, '');
        if (labelPattern.test(label)) {
          const dataCells = row.cells.filter(c => c.x >= colXs[0] - 5);
          return assignColumns(dataCells, colXs);
        }
      }
      return null;
    }

    // Extrai métricas (regexes sem espaços pois labels são normalizados)
    const girosTotaisRow    = getRowValues(/^girostotais$/i);
    const girosBonsRow      = getRowValues(/^girosbons$/i);
    const hProdRow          = getRowValues(/^h\.produtivas$/i);
    const hAcertoRow        = getRowValues(/^h\.acerto$/i);
    const hImprodRow        = getRowValues(/^h\.improd\.?$/i);
    const velRow            = getRowValues(/^velocidadem[eé]dia$/i);
    const qtdAcertosRow     = getRowValues(/^qtdacertos$/i);
    const despAcertoRow     = getRowValues(/^desperdicioacerto$/i);
    const despVirandoRow    = getRowValues(/^desperdiciovirando$/i);

    // Horas improdutivas por código
    const hiCodes = {};
    let inHI = false;
    for (const row of rows) {
      const text = row.cells.map(c => c.str).join('').replace(/\s+/g, '');
      if (/horasim?produtivastotal/i.test(text)) { inHI = true; continue; }
      if (/horasdeacertototal/i.test(text)) { inHI = false; break; }
      if (!inHI) continue;
      if (/atividadetotal/i.test(text)) continue;
      // Linha de código: começa com "NNN - Descrição"
      const codeMatch = row.cells[0]?.str.match(/^(\d{2,3})\s*-\s*(.+)/);
      if (codeMatch) {
        const codigo = codeMatch[1];
        const descricao = codeMatch[2];
        const dataCells = row.cells.filter(c => c.x >= colXs[0] - 5);
        hiCodes[codigo] = { descricao, values: assignColumns(dataCells, colXs) };
      }
    }

    // Preenche por mês
    months.forEach((m, i) => {
      const mes = m.mes;
      const gt  = girosTotaisRow  ? parseBR(girosTotaisRow[i])  : 0;
      const gb  = girosBonsRow    ? parseBR(girosBonsRow[i])    : 0;
      const hp  = hProdRow        ? parseBR(hProdRow[i])        : 0;
      const ha  = hAcertoRow      ? parseBR(hAcertoRow[i])      : 0;
      const hi  = hImprodRow      ? parseBR(hImprodRow[i])      : 0;
      const vel = velRow          ? parseBR(velRow[i])           : 0;
      const qa  = qtdAcertosRow   ? parseBR(qtdAcertosRow[i])   : 0;
      const da  = despAcertoRow   ? parseBR(despAcertoRow[i])   : 0;
      const dv  = despVirandoRow  ? parseBR(despVirandoRow[i])  : 0;

      if (gt === 0 && hp === 0 && hi === 0) return; // mês sem dados

      const hiDetalhe = [];
      for (const [codigo, info] of Object.entries(hiCodes)) {
        const h = info.values ? parseBR(info.values[i]) : 0;
        if (h > 0) hiDetalhe.push({ codigo, descricao: info.descricao, horas: h });
      }

      operadores[operadorNome].meses[mes] = {
        mes, ano,
        giros_totais: gt, giros_bons: gb,
        h_produtivas: hp, h_acerto: ha, h_improdutivas: hi,
        velocidade_media: vel, qtd_acertos: qa,
        desperdicio_acerto: da, desperdicio_virando: dv,
        horas_improdutivas_detalhe: hiDetalhe,
      };
    });
  }

  return operadores;
}

// ─── PARSER EXCEL ────────────────────────────────────────────────────────────
async function parseExcelBuffer(buffer) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const operadores = {};

  wb.worksheets.forEach(sheet => {
    let months    = [];   // [{ mes, ano, col }]  col = índice 1-based
    let opNome    = null;
    let inHI      = false;
    let hiCodes   = {};
    let metrics   = {};   // { label: { col: valor } }

    sheet.eachRow({ includeEmpty: false }, (row, rn) => {
      const cells = [];
      row.eachCell({ includeEmpty: true }, (cell, cn) => {
        cells[cn] = cell.text ? String(cell.text).trim() : '';
      });

      const first = cells[1] || '';

      // Linha de meses: detecta "jan/YYYY" em alguma célula
      const hasMonth = cells.some(c => /^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/\d{4}$/i.test(c));
      if (hasMonth) {
        // Salva dados do operador anterior antes de resetar
        if (opNome) {
          months.forEach(({ mes, ano }) => {
            const d = metrics[mes];
            if (!d || (!d.giros_totais && !d.h_produtivas && !d.h_improdutivas)) return;
            const hiDetalhe = Object.entries(hiCodes)
              .map(([codigo, info]) => ({ codigo, descricao: info.descricao, horas: info.vals[mes] || 0 }))
              .filter(h => h.horas > 0);
            operadores[opNome].meses[mes] = { mes, ano, ...d, horas_improdutivas_detalhe: hiDetalhe };
          });
        }
        months = [];
        cells.forEach((c, ci) => {
          const m = c && c.match(/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/(\d{4})$/i);
          if (m) months.push({ mes: MONTH_MAP[m[1].toLowerCase()], ano: parseInt(m[2]), col: ci });
        });
        opNome = null; inHI = false; hiCodes = {}; metrics = {};
        return;
      }

      if (!months.length) return;

      // Nome do operador (linha logo após meses, não é cabeçalho de seção)
      if (!opNome && first && !/^(indicadores|emitido|página|metrics|produtividade)/i.test(first)) {
        opNome = first.replace(/emitido por:.*/i, '').trim();
        if (opNome) {
          if (!operadores[opNome]) operadores[opNome] = { ano: months[0].ano, meses: {} };
        }
        return;
      }

      if (!opNome) return;

      // Detecta seções de horas improdutivas
      if (/horas im.?produtivas total/i.test(first)) { inHI = true; return; }
      if (/horas de acerto total/i.test(first))       { inHI = false; return; }
      if (/^(indicadores|emitido|página)/i.test(first)) return;

      // Linhas de códigos de horas improdutivas
      if (inHI && /^\d{2,3}\s*-/.test(first)) {
        const cm = first.match(/^(\d{2,3})\s*-\s*(.+)/);
        if (cm) {
          const vals = {};
          months.forEach(m => { vals[m.mes] = parseBR(cells[m.col] || ''); });
          hiCodes[cm[1]] = { descricao: cm[2].trim(), vals };
        }
        return;
      }

      // Linhas de métricas
      const LABEL_MAP = {
        'giros totais':       'giros_totais',
        'giros bons':         'giros_bons',
        'h.produtivas':       'h_produtivas',
        'h.acerto':           'h_acerto',
        'h.improd':           'h_improdutivas',
        'velocidade média':   'velocidade_media',
        'velocidade media':   'velocidade_media',
        'qtd acertos':        'qtd_acertos',
        'desperdicio acerto': 'desperdicio_acerto',
        'desperdicio virando':'desperdicio_virando',
      };
      const key = Object.keys(LABEL_MAP).find(k => first.toLowerCase().startsWith(k));
      if (key) {
        const field = LABEL_MAP[key];
        months.forEach(m => {
          if (!metrics[m.mes]) metrics[m.mes] = {};
          metrics[m.mes][field] = parseBR(cells[m.col] || '');
        });
      }
    });

    // Salva meses com dados
    months.forEach(({ mes, ano }) => {
      const d = metrics[mes];
      if (!d) return;
      if (!d.giros_totais && !d.h_produtivas && !d.h_improdutivas) return;

      const hiDetalhe = Object.entries(hiCodes)
        .map(([codigo, info]) => ({ codigo, descricao: info.descricao, horas: info.vals[mes] || 0 }))
        .filter(h => h.horas > 0);

      operadores[opNome].meses[mes] = { mes, ano, ...d, horas_improdutivas_detalhe: hiDetalhe };
    });
  });

  return operadores;
}

// POST /api/importar/preview — retorna dados extraídos sem salvar (PDF ou Excel)
router.post('/preview', auth, upload.single('arquivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
    const isExcel = req.file.originalname.match(/\.(xlsx|xls)$/i);
    const dados = isExcel
      ? await parseExcelBuffer(req.file.buffer)
      : await parsePDFBuffer(req.file.buffer);
    res.json({ dados });
  } catch (err) {
    console.error('Erro ao parsear arquivo:', err);
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/importar/salvar — salva os dados no banco
router.post('/salvar', auth, async (req, res) => {
  try {
    const { registros } = req.body; // [{ operador_id, mes, ano, ... }]
    if (!registros?.length) return res.status(400).json({ erro: 'Nenhum registro para salvar' });

    let salvos = 0;
    for (const r of registros) {
      await db.query(`
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
        RETURNING id
      `, [r.operador_id, r.ano, r.mes,
          Math.round(r.giros_totais||0), Math.round(r.giros_bons||0),
          r.h_produtivas||0, r.h_acerto||0, r.h_improdutivas||0,
          Math.round(r.velocidade_media||0), r.qtd_acertos||0,
          Math.round(r.desperdicio_acerto||0), Math.round(r.desperdicio_virando||0),
          req.usuario.id]);

      if (r.horas_improdutivas_detalhe?.length) {
        const { rows } = await db.query(
          'SELECT id FROM producao WHERE operador_id=$1 AND ano=$2 AND mes=$3',
          [r.operador_id, r.ano, r.mes]
        );
        if (rows[0]) {
          await db.query('DELETE FROM horas_improdutivas WHERE producao_id=$1', [rows[0].id]);
          for (const hi of r.horas_improdutivas_detalhe) {
            await db.query(
              'INSERT INTO horas_improdutivas (producao_id, codigo, descricao, horas) VALUES ($1,$2,$3,$4)',
              [rows[0].id, hi.codigo, hi.descricao, hi.horas]
            );
          }
        }
      }
      salvos++;
    }

    res.json({ mensagem: `${salvos} registros importados com sucesso` });
  } catch (err) {
    console.error('Erro ao salvar importação:', err);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
