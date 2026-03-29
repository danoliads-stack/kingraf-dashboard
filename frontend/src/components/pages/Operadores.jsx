import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { dashboardService } from '../../services/api';
import { ArrowLeft, User, TrendingUp, Award } from 'lucide-react';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const ANO_OPTIONS = [2024, 2025, 2026, 2027];

function fmt(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n/1e6).toFixed(2)+' M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+' k';
  return n.toFixed(0);
}

function hihtColor(v) {
  return v > 45 ? 'var(--red)' : v > 30 ? 'var(--amber)' : 'var(--green)';
}

export default function Operadores() {
  const [ano, setAno]           = useState(new Date().getFullYear());
  const [mes, setMes]           = useState(-1); // -1 = Total Ano
  const [setor, setSetor]       = useState('');
  const [totais, setTotais]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null); // operador individual
  const [detalhe, setDetalhe]   = useState(null);
  const [detLoading, setDetLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    if (mes >= 0) {
      // Filtrar por mês: usa ranking endpoint
      dashboardService.ranking({ ano, mes: mes + 1, setor: setor || undefined })
        .then(r => {
          // Adapta campo 'nome' para ser consistente e adiciona meses_com_dados
          const data = r.data.map(op => ({ ...op, meses_com_dados: 1 }));
          setTotais(data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      // Total anual
      dashboardService.totalAnual({ ano, setor: setor || undefined })
        .then(r => setTotais(r.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [ano, mes, setor]);

  const loadOperador = async (op) => {
    setSelected(op);
    setDetLoading(true);
    try {
      const { data } = await dashboardService.operador(op.id, { ano });
      setDetalhe(data);
    } catch { setDetalhe(null); }
    finally { setDetLoading(false); }
  };

  // Totais gerais
  const totGiros  = totais.reduce((a, r) => a + (Number(r.giros_totais) || 0), 0);
  const totProd   = totais.reduce((a, r) => a + (Number(r.h_produtivas) || 0), 0);
  const totImprod = totais.reduce((a, r) => a + (Number(r.h_improdutivas) || 0), 0);
  const totAcerto = totais.reduce((a, r) => a + (Number(r.h_acerto) || 0), 0);
  const totH      = totProd + totImprod + totAcerto;
  const hihtGeral = totH > 0 ? (totImprod / totH * 100) : 0;

  // === DETALHE INDIVIDUAL ===
  if (selected && detalhe) {
    const op = detalhe.operador;
    const meses = detalhe.meses;
    const codigos = detalhe.codigos;

    const totG = meses.reduce((a, m) => a + (Number(m.giros_totais) || 0), 0);
    const totP = meses.reduce((a, m) => a + (Number(m.h_produtivas) || 0), 0);
    const totI = meses.reduce((a, m) => a + (Number(m.h_improdutivas) || 0), 0);
    const totA = meses.reduce((a, m) => a + (Number(m.h_acerto) || 0), 0);
    const totAll = totP + totI + totA;
    const hiht = totAll > 0 ? (totI / totAll * 100) : 0;
    const avgVel = meses.length > 0 ? meses.reduce((a, m) => a + (Number(m.velocidade_media) || 0), 0) / meses.length : 0;

    const chartData = MESES.map((m, i) => {
      const d = meses.find(x => Number(x.mes) === i + 1);
      return {
        mes: m,
        'H. Produtivas': Number(d?.h_produtivas) || 0,
        'H. Acerto': Number(d?.h_acerto) || 0,
        'H. Improdutivas': Number(d?.h_improdutivas) || 0,
        'Hi/Ht %': Number(d?.hiht) || 0,
        'Giros': Number(d?.giros_totais) || 0,
      };
    });

    const maxCod = codigos.length > 0 ? Number(codigos[0].total_horas) : 1;

    return (
      <div>
        <div className="page-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button className="btn btn-outline btn-sm" onClick={() => { setSelected(null); setDetalhe(null); }} style={{gap:6}}>
              <ArrowLeft size={14}/> Voltar
            </button>
            <div>
              <h2 style={{display:'flex',alignItems:'center',gap:8}}>
                <User size={20}/> {op.nome}
              </h2>
              <p>{op.setor === 'opc' ? 'Corte e Vinco' : 'Colagem'} · {ano}</p>
            </div>
          </div>
        </div>

        {/* KPIs individuais */}
        <div className="kpi-grid mb-16">
          <div className="kpi-card">
            <div className="kpi-label">Giros Totais (Ano)</div>
            <div className="kpi-value">{fmt(totG)}</div>
            <div className="kpi-sub">{meses.length} meses com dados</div>
          </div>
          <div className="kpi-card green">
            <div className="kpi-label">H. Produtivas</div>
            <div className="kpi-value">{totP.toFixed(0)}h</div>
            <div className="kpi-sub">{totAll > 0 ? (totP/totAll*100).toFixed(1) : 0}% do total</div>
          </div>
          <div className="kpi-card red">
            <div className="kpi-label">H. Improdutivas</div>
            <div className="kpi-value">{totI.toFixed(0)}h</div>
            <div className="kpi-sub" style={{color: hihtColor(hiht)}}>Hi/Ht: <b>{hiht.toFixed(1)}%</b></div>
          </div>
          <div className="kpi-card blue">
            <div className="kpi-label">Vel. Media</div>
            <div className="kpi-value">{avgVel.toFixed(0)}</div>
            <div className="kpi-sub">giros/h produtiva</div>
          </div>
        </div>

        {/* Gráfico evolução mensal */}
        <div className="card mb-16">
          <div className="card-title"><span className="accent"></span>Evolucao Mensal — Horas</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{top:4,right:16,left:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{fontSize:11}} />
              <YAxis yAxisId="left" tick={{fontSize:11}} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={v=>v+'%'} tick={{fontSize:11}} domain={[0,100]} />
              <Tooltip formatter={(v,n) => [typeof v==='number'?v.toFixed(1)+(n.includes('%')?'%':'h'):v, n]} />
              <Legend wrapperStyle={{fontSize:11}} />
              <Bar yAxisId="left" dataKey="H. Produtivas"    stackId="a" fill="#1D9E75" />
              <Bar yAxisId="left" dataKey="H. Acerto"        stackId="a" fill="#185FA5" />
              <Bar yAxisId="left" dataKey="H. Improdutivas"  stackId="a" fill="#E24B4A" />
              <Line yAxisId="right" type="monotone" dataKey="Hi/Ht %" stroke="var(--orange)" strokeWidth={2.5} dot={{r:4}} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tabela mês a mês */}
        <div className="card mb-16">
          <div className="card-title"><span className="accent"></span>Dados por Mes</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mes</th><th>Giros</th><th>H.Prod</th><th>H.Acerto</th>
                  <th>H.Improd</th><th>Hi/Ht%</th><th>Velocidade</th><th>Qtd Acertos</th>
                </tr>
              </thead>
              <tbody>
                {meses.map(m => {
                  const h = Number(m.hiht) || 0;
                  return (
                    <tr key={m.mes}>
                      <td><b>{MESES_FULL[(m.mes)-1]}</b></td>
                      <td>{fmt(m.giros_totais)}</td>
                      <td style={{color:'var(--green)'}}>{Number(m.h_produtivas).toFixed(1)}h</td>
                      <td style={{color:'var(--blue)'}}>{Number(m.h_acerto).toFixed(1)}h</td>
                      <td style={{color:'var(--red)'}}>{Number(m.h_improdutivas).toFixed(1)}h</td>
                      <td style={{color:hihtColor(h),fontWeight:700}}>{h.toFixed(1)}%</td>
                      <td>{Number(m.velocidade_media).toFixed(0)}</td>
                      <td>{Number(m.qtd_acertos).toFixed(0)}</td>
                    </tr>
                  );
                })}
                {/* Total */}
                <tr style={{fontWeight:700,borderTop:'2px solid var(--line)'}}>
                  <td>TOTAL</td>
                  <td>{fmt(totG)}</td>
                  <td style={{color:'var(--green)'}}>{totP.toFixed(1)}h</td>
                  <td style={{color:'var(--blue)'}}>{totA.toFixed(1)}h</td>
                  <td style={{color:'var(--red)'}}>{totI.toFixed(1)}h</td>
                  <td style={{color:hihtColor(hiht)}}>{hiht.toFixed(1)}%</td>
                  <td>{avgVel.toFixed(0)}</td>
                  <td>{meses.reduce((a,m) => a + (Number(m.qtd_acertos)||0), 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Causas improdutividade */}
        {codigos.length > 0 && (
          <div className="card">
            <div className="card-title"><span className="accent" style={{background:'var(--red)'}}></span>Causas de Improdutividade (Ano)</div>
            {codigos.map((c, i) => {
              const pct = (Number(c.total_horas) / maxCod * 100).toFixed(0);
              const colors = ['var(--red)','var(--amber)','var(--blue)','var(--green)','var(--gray)'];
              return (
                <div key={i} style={{marginBottom:9}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                    <span style={{fontSize:10,color:'var(--gray)'}}>{c.codigo} — {c.descricao || '—'}</span>
                    <span style={{fontSize:11,fontWeight:700}}>{Number(c.total_horas).toFixed(1)}h</span>
                  </div>
                  <div style={{background:'var(--line)',borderRadius:4,height:8}}>
                    <div style={{width:`${pct}%`,background:colors[i%colors.length],height:8,borderRadius:4}}/>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // === VISAO GERAL / LISTA ===
  return (
    <div>
      <div className="page-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h2>Operadores — {mes >= 0 ? MESES_FULL[mes] : 'Desempenho'} {ano}</h2>
          <p>Total anual e desempenho individual · Clique no operador para ver detalhes</p>
        </div>
        <div style={{display:'flex',gap:10}}>
          <select className="form-input" style={{width:120}} value={setor} onChange={e => setSetor(e.target.value)}>
            <option value="">Todos</option>
            <option value="opc">Corte e Vinco</option>
            <option value="ope">Colagem</option>
          </select>
          <select className="form-input" style={{width:100}} value={ano} onChange={e => setAno(Number(e.target.value))}>
            {ANO_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Seletor de mês */}
      <div className="month-pills">
        <button className={`month-pill ${mes===-1?'active':''}`} onClick={()=>setMes(-1)} style={mes===-1?{fontWeight:700}:{}}>Total Ano</button>
        {MESES.map((m, i) => (
          <button key={i} className={`month-pill ${i===mes?'active':''}`} onClick={()=>setMes(i)}>{m}</button>
        ))}
      </div>

      {/* KPIs gerais do ano */}
      <div className="kpi-grid mb-16">
        <div className="kpi-card">
          <div className="kpi-label">Giros Totais {mes >= 0 ? `(${MESES[mes]})` : '(Ano)'}</div>
          <div className="kpi-value">{fmt(totGiros)}</div>
          <div className="kpi-sub">{totais.length} operadores</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-label">H. Produtivas</div>
          <div className="kpi-value">{totProd.toFixed(0)}h</div>
          <div className="kpi-sub">{totH > 0 ? (totProd/totH*100).toFixed(1) : 0}%</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-label">H. Improdutivas</div>
          <div className="kpi-value">{totImprod.toFixed(0)}h</div>
          <div className="kpi-sub" style={{color:hihtColor(hihtGeral)}}>Hi/Ht: <b>{hihtGeral.toFixed(1)}%</b></div>
        </div>
        <div className="kpi-card blue">
          <div className="kpi-label">H. Acerto</div>
          <div className="kpi-value">{totAcerto.toFixed(0)}h</div>
        </div>
      </div>

      {/* Tabela de operadores */}
      <div className="card">
        <div className="card-title">
          <span><span className="accent"></span>{mes >= 0 ? `Ranking ${MESES_FULL[mes]}` : 'Ranking Anual'} — {ano}</span>
          <span style={{fontSize:11,color:'var(--gray)',fontWeight:400}}>{totais.length} operadores</span>
        </div>
        {loading ? (
          <div style={{padding:30,textAlign:'center',color:'var(--gray)'}}>Carregando...</div>
        ) : totais.length === 0 ? (
          <div style={{padding:30,textAlign:'center',color:'var(--gray)'}}>
            Nenhum dado para {ano}. Alimente os dados na aba <b>Alimentar Dados</b>.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{width:40}}>#</th>
                  <th>Operador</th>
                  <th>Setor</th>
                  <th>Giros</th>
                  <th>H.Prod</th>
                  <th>H.Acerto</th>
                  <th>H.Improd</th>
                  <th>Hi/Ht %</th>
                  <th>Vel. Media</th>
                  <th>Meses</th>
                  <th>Distribuicao</th>
                </tr>
              </thead>
              <tbody>
                {totais.map((r, i) => {
                  const h = Number(r.hiht) || 0;
                  const tH = (Number(r.h_produtivas)||0)+(Number(r.h_acerto)||0)+(Number(r.h_improdutivas)||0);
                  const pP = tH>0?((Number(r.h_produtivas)||0)/tH*100).toFixed(0):0;
                  const pA = tH>0?((Number(r.h_acerto)||0)/tH*100).toFixed(0):0;
                  const pI = tH>0?((Number(r.h_improdutivas)||0)/tH*100).toFixed(0):0;
                  const medal = ['🥇','🥈','🥉'][i] || `${i+1}`;
                  return (
                    <tr key={r.id} onClick={() => loadOperador(r)} style={{cursor:'pointer'}} title="Clique para ver detalhes">
                      <td style={{textAlign:'center',fontSize:i<3?16:13}}>{medal}</td>
                      <td><b>{r.nome}</b></td>
                      <td>
                        <span className={`badge ${r.setor==='opc'?'badge-blue':'badge-amber'}`}>
                          {r.setor==='opc'?'C&V':'Col'}
                        </span>
                      </td>
                      <td>{fmt(r.giros_totais)}</td>
                      <td style={{color:'var(--green)',fontWeight:600}}>{(Number(r.h_produtivas)||0).toFixed(0)}h</td>
                      <td style={{color:'var(--blue)',fontWeight:600}}>{(Number(r.h_acerto)||0).toFixed(0)}h</td>
                      <td style={{color:'var(--red)',fontWeight:600}}>{(Number(r.h_improdutivas)||0).toFixed(0)}h</td>
                      <td style={{color:hihtColor(h),fontWeight:800}}>{h.toFixed(1)}%</td>
                      <td>{(Number(r.velocidade_media)||0).toFixed(0)}</td>
                      <td style={{color:'var(--gray)',fontSize:11}}>{r.meses_com_dados}</td>
                      <td style={{minWidth:100}}>
                        <div className="stacked-bar">
                          <div style={{width:`${pP}%`,background:'var(--green)'}}/>
                          <div style={{width:`${pA}%`,background:'var(--blue)'}}/>
                          <div style={{width:`${pI}%`,background:'var(--red)'}}/>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {/* Linha de total */}
                <tr style={{fontWeight:700,borderTop:'2px solid var(--line)',background:'var(--gray-l)'}}>
                  <td></td>
                  <td>TOTAL GERAL</td>
                  <td></td>
                  <td>{fmt(totGiros)}</td>
                  <td style={{color:'var(--green)'}}>{totProd.toFixed(0)}h</td>
                  <td style={{color:'var(--blue)'}}>{totAcerto.toFixed(0)}h</td>
                  <td style={{color:'var(--red)'}}>{totImprod.toFixed(0)}h</td>
                  <td style={{color:hihtColor(hihtGeral)}}>{hihtGeral.toFixed(1)}%</td>
                  <td>{totais.length > 0 ? (totais.reduce((a,r) => a+(Number(r.velocidade_media)||0),0)/totais.length).toFixed(0) : 0}</td>
                  <td></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
