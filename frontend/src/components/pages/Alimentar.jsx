import { useState, useEffect, useRef } from 'react';
import { operadoresService, producaoService, importarService } from '../../services/api';
import toast from 'react-hot-toast';
import { Save, Trash2, Upload, FileText, CheckCircle, X } from 'lucide-react';

const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const ANO_OPTIONS = [2024, 2025, 2026, 2027];

const CODIGOS_IMPROD = [
  { codigo: '901', descricao: 'Sem Serviço' },
  { codigo: '911', descricao: 'Troca de Apontamento' },
  { codigo: '912', descricao: 'Parada para refeição (almoço/janta)' },
  { codigo: '913', descricao: 'Troca de turno / início de expediente' },
  { codigo: '914', descricao: 'Fim de expediente / sem programação' },
  { codigo: '915', descricao: 'Aguardando setup / preparação' },
  { codigo: '916', descricao: 'Falta de material / insumo' },
  { codigo: '202', descricao: 'Manutenção Corretiva' },
  { codigo: '208', descricao: 'Montar destaque em máquina' },
  { codigo: '300', descricao: 'Aguardar secar material' },
  { codigo: '503', descricao: 'Lavar blanqueta' },
];

const emptyForm = (anoVal) => ({
  operador_id: '',
  ano: anoVal || new Date().getFullYear(),
  mes: new Date().getMonth() + 1,
  giros_totais: '',
  giros_bons: '',
  h_produtivas: '',
  h_acerto: '',
  h_improdutivas: '',
  velocidade_media: '',
  qtd_acertos: '',
  desperdicio_acerto: '',
  desperdicio_virando: '',
  horas_improdutivas_detalhe: [],
});

export default function Alimentar() {
  const [operadores, setOperadores] = useState([]);
  const [registros,  setRegistros]  = useState([]);
  const [form, setForm]             = useState(emptyForm());
  const [setor, setSetor]           = useState('opc');
  const [loading, setLoading]       = useState(false);
  const [codHoras, setCodHoras]     = useState({});
  const [ano, setAno]               = useState(new Date().getFullYear());

  // Importação PDF/Excel — por setor
  const fileOPCRef  = useRef(null);
  const fileOPERef  = useRef(null);
  const excelOPCRef = useRef(null);
  const excelOPERef = useRef(null);
  const [importLoading, setImportLoading] = useState(false);
  const [excelLoading,  setExcelLoading]  = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [selectedRows,  setSelectedRows]  = useState({});

  useEffect(() => {
    operadoresService.listar(setor).then(r => setOperadores(r.data)).catch(()=>{});
  }, [setor]);

  useEffect(() => {
    producaoService.listar({ ano }).then(r => setRegistros(r.data)).catch(()=>{});
  }, [ano]);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCodHora = (codigo, horas) => {
    setCodHoras(prev => ({ ...prev, [codigo]: horas }));
  };

  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

  const matchOperadores = (nomeOp, operadoresDoSetor) => {
    const normPDF = norm(nomeOp);
    return operadoresDoSetor.find(o => {
      const normOp = norm(o.nome);
      const firstWordPDF = normPDF.split(' ')[0];
      const lastWordPDF  = normPDF.split(' ').slice(-1)[0];
      return normPDF.includes(normOp)
        || normOp.includes(normPDF)
        || (normOp.split(' ')[0] === firstWordPDF && normOp.split(' ').slice(-1)[0] === lastWordPDF);
    });
  };

  const processarArquivo = async (file, setorArquivo, setLoading) => {
    setLoading(true);
    try {
      const [{ data: opsSetor }, { data }] = await Promise.all([
        operadoresService.listar(setorArquivo),
        importarService.preview(file),
      ]);
      const rows = [];
      for (const [nomeOp, info] of Object.entries(data.dados)) {
        for (const [, dados] of Object.entries(info.meses)) {
          rows.push({ nomeOp, ...dados, setor: setorArquivo });
        }
      }
      rows.sort((a, b) => a.nomeOp.localeCompare(b.nomeOp) || a.mes - b.mes);
      const matchedRows = rows.map(r => {
        const op = matchOperadores(r.nomeOp, opsSetor);
        return { ...r, operador_id: op?.id || null, operador_nome_db: op?.nome || null };
      });
      const sel = {};
      matchedRows.forEach((_, i) => { sel[i] = true; });
      setImportPreview(matchedRows);
      setSelectedRows(sel);
      const setor_label = setorArquivo === 'opc' ? 'Corte e Vinco' : 'Colagem';
      toast.success(`${rows.length} registros encontrados — ${setor_label}`);
    } catch (err) {
      toast.error(err.response?.data?.erro || 'Erro ao processar arquivo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExcelUpload = (setorArquivo) => async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await processarArquivo(file, setorArquivo, setExcelLoading);
    e.target.value = '';
  };

  const handlePDFUpload = (setorArquivo) => async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await processarArquivo(file, setorArquivo, setImportLoading);
    e.target.value = '';
  };

  const confirmarImportacao = async () => {
    const registros = importPreview
      .filter((_, i) => selectedRows[i] && importPreview[i].operador_id)
      .map(r => ({ ...r }));
    if (!registros.length) { toast.error('Nenhum registro válido selecionado'); return; }
    setImportLoading(true);
    try {
      const { data } = await importarService.salvar(registros);
      toast.success(data.mensagem);
      setImportPreview(null);
      setSelectedRows({});
      const anoImportado = registros[0]?.ano || ano;
      if (anoImportado !== ano) setAno(anoImportado);
      producaoService.listar({ ano: anoImportado }).then(r => setRegistros(r.data));
    } catch (err) {
      toast.error(err.response?.data?.erro || 'Erro ao salvar');
    } finally {
      setImportLoading(false);
    }
  };

  const salvar = async () => {
    if (!form.operador_id) { toast.error('Selecione um operador'); return; }
    if (!form.h_produtivas) { toast.error('Preencha H. Produtivas'); return; }
    setLoading(true);
    try {
      const detalhe = Object.entries(codHoras)
        .filter(([, h]) => h > 0)
        .map(([codigo, horas]) => ({
          codigo,
          descricao: CODIGOS_IMPROD.find(c => c.codigo === codigo)?.descricao || '',
          horas: Number(horas),
        }));

      await producaoService.salvar({
        ...form,
        giros_totais: Number(form.giros_totais)||0,
        giros_bons:   Number(form.giros_bons)||0,
        h_produtivas: Number(form.h_produtivas)||0,
        h_acerto:     Number(form.h_acerto)||0,
        h_improdutivas: Number(form.h_improdutivas)||0,
        velocidade_media: Number(form.velocidade_media)||0,
        qtd_acertos:  Number(form.qtd_acertos)||0,
        horas_improdutivas_detalhe: detalhe,
      });
      toast.success('Registro salvo com sucesso!');
      setForm(emptyForm(ano));
      setCodHoras({});
      producaoService.listar({ ano }).then(r => setRegistros(r.data));
    } catch (err) {
      toast.error(err.response?.data?.erro || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const deletar = async (id) => {
    if (!confirm('Remover este registro?')) return;
    await producaoService.deletar(id);
    setRegistros(r => r.filter(x => x.id !== id));
    toast.success('Registro removido');
  };

  const opsFiltrados = operadores.filter(o => o.setor === setor);

  return (
    <div>
      <div className="page-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h2>Alimentar Dados</h2>
          <p>Insira os dados mensais por operador · {ano}</p>
        </div>
        <select className="form-input" style={{width:100}} value={ano} onChange={e => { setAno(Number(e.target.value)); setF('ano', Number(e.target.value)); }}>
          {ANO_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Importar Excel / PDF */}
      <div className="card mb-16" style={{borderLeft:'3px solid var(--accent)'}}>
        <div className="card-title"><span className="accent"></span>Importar via Excel ou PDF (Metrics PCP)</div>
        <p style={{fontSize:12,color:'var(--gray)',marginBottom:8}}>
          Selecione o setor do relatório antes de importar. O match de operadores será feito apenas dentro do setor.
        </p>

        {/* Corte e Vinco */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--accent)',textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>
            Corte e Vinco
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <input ref={excelOPCRef} type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={handleExcelUpload('opc')}/>
            <button className="btn btn-primary" onClick={() => excelOPCRef.current.click()} disabled={excelLoading||importLoading} style={{gap:8,fontSize:13}}>
              <Upload size={14}/> {excelLoading ? 'Importando...' : 'Excel Corte e Vinco'}
            </button>
            <input ref={fileOPCRef} type="file" accept=".pdf" style={{display:'none'}} onChange={handlePDFUpload('opc')}/>
            <button className="btn btn-outline" onClick={() => fileOPCRef.current.click()} disabled={importLoading||excelLoading} style={{gap:8,fontSize:13}}>
              <FileText size={14}/> {importLoading ? 'Processando...' : 'PDF Corte e Vinco'}
            </button>
          </div>
        </div>

        {/* Colagem */}
        <div style={{borderTop:'1px solid var(--line)',paddingTop:12}}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--amber)',textTransform:'uppercase',letterSpacing:.5,marginBottom:6}}>
            Colagem
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <input ref={excelOPERef} type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={handleExcelUpload('ope')}/>
            <button className="btn btn-primary" onClick={() => excelOPERef.current.click()} disabled={excelLoading||importLoading} style={{gap:8,fontSize:13}}>
              <Upload size={14}/> {excelLoading ? 'Importando...' : 'Excel Colagem'}
            </button>
            <input ref={fileOPERef} type="file" accept=".pdf" style={{display:'none'}} onChange={handlePDFUpload('ope')}/>
            <button className="btn btn-outline" onClick={() => fileOPERef.current.click()} disabled={importLoading||excelLoading} style={{gap:8,fontSize:13}}>
              <FileText size={14}/> {importLoading ? 'Processando...' : 'PDF Colagem'}
            </button>
          </div>
        </div>
      </div>

      {/* Preview da importação */}
      {importPreview && (
        <div className="card mb-16">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <div className="card-title" style={{margin:0}}><span className="accent"></span>Preview — {importPreview.length} registros extraídos</div>
            <button className="btn btn-outline btn-sm" onClick={() => setImportPreview(null)} style={{color:'var(--red)'}}><X size={14}/></button>
          </div>
          <div className="table-wrap" style={{maxHeight:340,overflowY:'auto'}}>
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" onChange={e=>{const s={};importPreview.forEach((_,i)=>s[i]=e.target.checked);setSelectedRows(s);}}/></th>
                  <th>Operador (PDF)</th><th>Match</th><th>Setor</th><th>Mês/Ano</th>
                  <th>Giros Tot.</th><th>H.Prod</th><th>H.Improd</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.map((r, i) => (
                  <tr key={i} style={{opacity: r.operador_id ? 1 : 0.5}}>
                    <td><input type="checkbox" checked={!!selectedRows[i]} onChange={e=>setSelectedRows(s=>({...s,[i]:e.target.checked}))}/></td>
                    <td style={{fontSize:12}}>{r.nomeOp}</td>
                    <td>
                      {r.operador_id
                        ? <span style={{color:'var(--green)',fontSize:11,fontWeight:700}}><CheckCircle size={11}/> {r.operador_nome_db}</span>
                        : <span style={{color:'var(--red)',fontSize:11}}>Não encontrado</span>}
                    </td>
                    <td><span className={`badge ${r.setor==='opc'?'badge-blue':'badge-amber'}`} style={{fontSize:10}}>{r.setor==='opc'?'Corte/Vinco':'Colagem'}</span></td>
                    <td style={{fontSize:12}}>{['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][r.mes-1]}/{r.ano}</td>
                    <td style={{fontSize:12}}>{(r.giros_totais/1e6).toFixed(2)}M</td>
                    <td style={{fontSize:12}}>{Number(r.h_produtivas).toFixed(1)}h</td>
                    <td style={{fontSize:12}}>{Number(r.h_improdutivas).toFixed(1)}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{marginTop:12,display:'flex',gap:8,alignItems:'center'}}>
            <button className="btn btn-primary" onClick={confirmarImportacao} disabled={importLoading}>
              <FileText size={14}/> {importLoading ? 'Salvando...' : `Importar ${Object.values(selectedRows).filter(Boolean).length} registros`}
            </button>
            <button className="btn btn-outline" onClick={() => setImportPreview(null)}>Cancelar</button>
            {importPreview.some(r => !r.operador_id) && (
              <span style={{fontSize:11,color:'var(--amber)'}}>
                ⚠ Registros sem match serao ignorados
              </span>
            )}
          </div>
        </div>
      )}

      {/* Formulário */}
      <div className="card mb-16">
        <div className="card-title"><span className="accent"></span>Novo Registro</div>

        {/* Setor + Mês + Operador */}
        <div className="form-grid-3 mb-16">
          <div className="form-group">
            <label className="form-label">Setor</label>
            <select className="form-input" value={setor} onChange={e => { setSetor(e.target.value); setF('operador_id',''); }}>
              <option value="opc">Corte e Vinco</option>
              <option value="ope">Colagem</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Mês</label>
            <select className="form-input" value={form.mes} onChange={e => setF('mes', Number(e.target.value))}>
              {MESES_FULL.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Operador</label>
            <select className="form-input" value={form.operador_id} onChange={e => setF('operador_id', e.target.value)}>
              <option value="">Selecione...</option>
              {opsFiltrados.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
        </div>

        <div style={{borderTop:'1px solid var(--line)',paddingTop:14,marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:'var(--gray)',marginBottom:10,textTransform:'uppercase',letterSpacing:.5}}>Indicadores de Produção</div>
          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label">Giros Totais</label>
              <input className="form-input" type="number" placeholder="Ex: 2700000" value={form.giros_totais} onChange={e=>setF('giros_totais',e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Giros Bons</label>
              <input className="form-input" type="number" placeholder="Ex: 2695000" value={form.giros_bons} onChange={e=>setF('giros_bons',e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Velocidade Média (giros/h)</label>
              <input className="form-input" type="number" placeholder="Ex: 3500" value={form.velocidade_media} onChange={e=>setF('velocidade_media',e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">H. Produtivas</label>
              <input className="form-input" type="number" step="0.1" placeholder="Ex: 85.5" value={form.h_produtivas} onChange={e=>setF('h_produtivas',e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">H. Acerto</label>
              <input className="form-input" type="number" step="0.1" placeholder="Ex: 70.2" value={form.h_acerto} onChange={e=>setF('h_acerto',e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">H. Improdutivas</label>
              <input className="form-input" type="number" step="0.1" placeholder="Ex: 45.0" value={form.h_improdutivas} onChange={e=>setF('h_improdutivas',e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Qtd. Acertos</label>
              <input className="form-input" type="number" step="0.1" placeholder="Ex: 42" value={form.qtd_acertos} onChange={e=>setF('qtd_acertos',e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Desperdício Acerto</label>
              <input className="form-input" type="number" placeholder="Ex: 150" value={form.desperdicio_acerto} onChange={e=>setF('desperdicio_acerto',e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Desperdício Virando</label>
              <input className="form-input" type="number" placeholder="Ex: 30" value={form.desperdicio_virando} onChange={e=>setF('desperdicio_virando',e.target.value)}/>
            </div>
          </div>
        </div>

        {/* Detalhamento Improdutivo */}
        <div style={{borderTop:'1px solid var(--line)',paddingTop:14,marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:'var(--gray)',marginBottom:10,textTransform:'uppercase',letterSpacing:.5}}>
            Detalhamento Improdutivo por Código
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {CODIGOS_IMPROD.map(c => (
              <div key={c.codigo} style={{display:'flex',alignItems:'center',gap:8,background:'var(--gray-l)',borderRadius:8,padding:'8px 12px'}}>
                <span style={{fontSize:11,fontWeight:700,color:'var(--dark)',minWidth:32}}>{c.codigo}</span>
                <span style={{fontSize:11,color:'var(--gray)',flex:1}}>{c.descricao}</span>
                <input
                  type="number" step="0.1" min="0" placeholder="0h"
                  style={{width:64,border:'1px solid var(--line)',borderRadius:6,padding:'4px 8px',fontSize:12,textAlign:'right'}}
                  value={codHoras[c.codigo]||''}
                  onChange={e=>handleCodHora(c.codigo, Number(e.target.value))}
                />
              </div>
            ))}
          </div>
        </div>

        <button className="btn btn-primary" onClick={salvar} disabled={loading} style={{minWidth:160}}>
          <Save size={15}/> {loading ? 'Salvando...' : 'Salvar Registro'}
        </button>
      </div>

      {/* Registros salvos */}
      <div className="card">
        <div className="card-title"><span className="accent"></span>Registros Salvos — {ano}</div>
        {registros.length === 0 ? (
          <div style={{padding:24,textAlign:'center',color:'var(--gray)',fontSize:13}}>Nenhum registro ainda.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mês</th><th>Setor</th><th>Operador</th>
                  <th>Giros</th><th>H.Prod</th><th>H.Improd</th><th>Hi/Ht%</th>
                  <th>Atualizado</th><th></th>
                </tr>
              </thead>
              <tbody>
                {registros.map(r => {
                  const t=(Number(r.h_produtivas)||0)+(Number(r.h_acerto)||0)+(Number(r.h_improdutivas)||0);
                  const hiht=t>0?((Number(r.h_improdutivas)||0)/t*100):0;
                  const col=hiht>45?'var(--red)':hiht>30?'var(--amber)':'var(--green)';
                  return (
                    <tr key={r.id}>
                      <td>{MESES_FULL[r.mes-1]}</td>
                      <td><span className={`badge ${r.setor==='opc'?'badge-blue':'badge-amber'}`}>{r.setor==='opc'?'Corte e Vinco':'Colagem'}</span></td>
                      <td><b>{r.operador_nome}</b></td>
                      <td>{(Number(r.giros_totais)/1e6).toFixed(2)} M</td>
                      <td>{Number(r.h_produtivas).toFixed(0)}h</td>
                      <td>{Number(r.h_improdutivas).toFixed(0)}h</td>
                      <td style={{color:col,fontWeight:700}}>{hiht.toFixed(1)}%</td>
                      <td style={{color:'var(--gray)',fontSize:11}}>{new Date(r.atualizado_em).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={()=>deletar(r.id)} style={{color:'var(--red)'}}>
                          <Trash2 size={12}/>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
