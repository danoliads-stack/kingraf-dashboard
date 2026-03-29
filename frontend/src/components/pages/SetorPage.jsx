import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { dashboardService } from '../../services/api';
import { AlertTriangle } from 'lucide-react';

const MESES      = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const ANO_OPTIONS = [2024, 2025, 2026, 2027];

function fmt(n) {
  n = Number(n)||0;
  if (n>=1e6) return (n/1e6).toFixed(2)+' M';
  if (n>=1e3) return (n/1e3).toFixed(1)+' k';
  return n.toFixed(0);
}

function badgeStatus(hiht, setor) {
  if (setor === 'opc') {
    if (hiht < 25) return { cls:'badge-green', txt:'Excelente' };
    if (hiht < 35) return { cls:'badge-green', txt:'Bom' };
    if (hiht < 45) return { cls:'badge-amber', txt:'Atenção' };
    return { cls:'badge-red', txt:'Crítico' };
  }
  if (hiht < 60) return { cls:'badge-amber', txt:'Regular' };
  if (hiht < 75) return { cls:'badge-red',   txt:'Atenção' };
  return { cls:'badge-red', txt:'Crítico' };
}

export default function SetorPage({ setor }) {
  const [ano, setAno]         = useState(new Date().getFullYear());
  const [mes, setMes]         = useState(-1); // -1 = Total Ano
  const [ranking, setRanking] = useState([]);
  const [codigos, setCodigos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = { ano, setor };
    if (mes >= 0) params.mes = mes + 1;
    Promise.all([
      dashboardService.ranking(params),
      dashboardService.improdoitivoCodigos(params),
    ]).then(([r, c]) => {
      setRanking(r.data);
      setCodigos(c.data);
    }).catch(()=>{}).finally(()=>setLoading(false));
  }, [mes, setor, ano]);

  const titulo    = setor === 'opc' ? 'Corte e Vinco' : 'Colagem';
  const cor       = setor === 'opc' ? 'var(--orange)' : 'var(--amber)';
  const maxImprod = Math.max(...ranking.map(r => Number(r.h_improdutivas)||0), 1);
  const maxCod    = codigos.length > 0 ? Number(codigos[0].total_horas) : 1;

  return (
    <div>
      <div className="page-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h2>{titulo}</h2>
          <p>Ranking por volume · velocidade · agilidade no acerto · {ano}</p>
        </div>
        <select className="form-input" style={{width:100}} value={ano} onChange={e => setAno(Number(e.target.value))}>
          {ANO_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Seletor de mês */}
      <div className="month-pills">
        <button className={`month-pill ${mes===-1?'active':''}`} onClick={()=>setMes(-1)} style={mes===-1?{fontWeight:700}:{}}>Total Ano</button>
        {MESES.map((m, i) => (
          <button key={i} className={`month-pill ${i===mes?'active':''}`} onClick={()=>setMes(i)}>{m}</button>
        ))}
      </div>

      {setor === 'ope' && (
        <div className="alert alert-warn mb-16">
          <AlertTriangle size={16} style={{flexShrink:0,marginTop:1}}/>
          <span><b>Atenção:</b> Hi/Ht da Colagem está distorcido pelo código 911 — Troca de Apontamento. Implantação de apontamento automático em andamento.</span>
        </div>
      )}

      {/* KPIs do setor */}
      {ranking.length > 0 && (() => {
        const totG = ranking.reduce((a,r)=>a+(Number(r.giros_totais)||0),0);
        const totP = ranking.reduce((a,r)=>a+(Number(r.h_produtivas)||0),0);
        const totI = ranking.reduce((a,r)=>a+(Number(r.h_improdutivas)||0),0);
        const totA = ranking.reduce((a,r)=>a+(Number(r.h_acerto)||0),0);
        const totH = totP+totI+totA;
        const hiht = totH>0?(totI/totH*100):0;
        return (
          <div className="kpi-grid mb-16">
            <div className="kpi-card"><div className="kpi-label">Giros Totais</div><div className="kpi-value">{fmt(totG)}</div><div className="kpi-sub">{mes >= 0 ? MESES_FULL[mes] : `Total ${ano}`}</div></div>
            <div className="kpi-card green"><div className="kpi-label">H. Produtivas</div><div className="kpi-value">{totP.toFixed(0)}h</div></div>
            <div className="kpi-card red"><div className="kpi-label">H. Improdutivas</div><div className="kpi-value">{totI.toFixed(0)}h</div><div className="kpi-sub" style={{color:hiht>45?'var(--red)':'var(--gray)'}}>Hi/Ht: {hiht.toFixed(1)}%</div></div>
            <div className="kpi-card blue"><div className="kpi-label">H. Acerto</div><div className="kpi-value">{totA.toFixed(0)}h</div></div>
          </div>
        );
      })()}

      {/* Ranking */}
      <div className="card mb-16">
        <div className="card-title">
          <span><span className="accent" style={{background:cor}}></span>Ranking de Operadores — {mes >= 0 ? MESES_FULL[mes] : `Total ${ano}`}</span>
          <span style={{fontSize:11,color:'var(--gray)',fontWeight:400}}>Pontuação: Volume 40% · Velocidade 35% · Acerto 25%</span>
        </div>
        {loading ? (
          <div style={{padding:30,textAlign:'center',color:'var(--gray)'}}>Carregando...</div>
        ) : ranking.length === 0 ? (
          <div style={{padding:30,textAlign:'center',color:'var(--gray)'}}>
            Nenhum dado para {mes >= 0 ? MESES_FULL[mes] : `Total ${ano}`} {ano}.<br/>
            <span style={{fontSize:12}}>Alimente os dados na aba <b>Alimentar Dados</b>.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{width:48}}>Pos.</th>
                  <th>Operador</th>
                  <th>Pontuação</th>
                  <th>Giros</th>
                  <th>Vel/HProd</th>
                  <th>H/Acerto</th>
                  <th>H. Improd.</th>
                  <th>Hi/Ht %</th>
                  <th>Distribuição</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => {
                  const hiht    = Number(r.hiht)||0;
                  const hPerAc  = Number(r.h_por_acerto)||0;
                  const totH    = (Number(r.h_produtivas)||0)+(Number(r.h_acerto)||0)+(Number(r.h_improdutivas)||0);
                  const pP      = totH>0?((Number(r.h_produtivas)||0)/totH*100).toFixed(0):0;
                  const pA      = totH>0?((Number(r.h_acerto)||0)/totH*100).toFixed(0):0;
                  const pI      = totH>0?((Number(r.h_improdutivas)||0)/totH*100).toFixed(0):0;
                  const hihtCol = hiht>45?'var(--red)':hiht>30?'var(--amber)':'var(--green)';
                  const medal   = ['🥇','🥈','🥉'][i] || `${i+1}°`;
                  const { cls, txt } = badgeStatus(hiht, setor);
                  return (
                    <tr key={r.id}>
                      <td style={{textAlign:'center',fontSize:16}}>{medal}</td>
                      <td><b>{r.nome}</b></td>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:80,background:'var(--line)',borderRadius:4,height:8,overflow:'hidden'}}>
                            <div style={{width:`${Math.min(r.score,100)}%`,background:'var(--blue)',height:8,borderRadius:4}}/>
                          </div>
                          <span style={{fontSize:11,fontWeight:700}}>{Number(r.score).toFixed(1)}</span>
                        </div>
                      </td>
                      <td>{fmt(r.giros_totais)}</td>
                      <td style={{color:'var(--blue)',fontWeight:700}}>{(Number(r.velocidade_media)||0).toFixed(0)}</td>
                      <td style={{color:'var(--green)',fontWeight:700}}>{hPerAc.toFixed(2)}h</td>
                      <td>{(Number(r.h_improdutivas)||0).toFixed(0)}h</td>
                      <td style={{color:hihtCol,fontWeight:800}}>{hiht.toFixed(1)}%</td>
                      <td style={{minWidth:100}}>
                        <div className="stacked-bar">
                          <div style={{width:`${pP}%`,background:'var(--green)'}}/>
                          <div style={{width:`${pA}%`,background:'var(--blue)'}}/>
                          <div style={{width:`${pI}%`,background:'var(--red)'}}/>
                        </div>
                      </td>
                      <td><span className={`badge ${cls}`}>{txt}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid-2">
        {/* Gráfico improdutivo */}
        <div className="card">
          <div className="card-title"><span className="accent" style={{background:cor}}></span>Horas Improdutivas por Operador</div>
          {ranking.length === 0 ? <div style={{padding:20,textAlign:'center',color:'var(--gray)',fontSize:12}}>Sem dados</div> :
            [...ranking].sort((a,b)=>(Number(b.h_improdutivas)||0)-(Number(a.h_improdutivas)||0)).map(r => {
              const hiht = Number(r.hiht)||0;
              const col  = hiht>45?'var(--red)':hiht>30?'var(--amber)':'var(--green)';
              const pct  = ((Number(r.h_improdutivas)||0)/maxImprod*100).toFixed(0);
              return (
                <div key={r.id} style={{marginBottom:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                    <span style={{fontSize:11,color:'var(--gray)'}}>{r.nome}</span>
                    <span style={{fontSize:11,fontWeight:700,color:col}}>{(Number(r.h_improdutivas)||0).toFixed(0)}h · {hiht.toFixed(1)}%</span>
                  </div>
                  <div style={{background:'var(--line)',borderRadius:4,height:10}}>
                    <div style={{width:`${pct}%`,background:col,height:10,borderRadius:4}}/>
                  </div>
                </div>
              );
            })
          }
        </div>

        {/* Causas improdutividade */}
        <div className="card">
          <div className="card-title"><span className="accent" style={{background:'var(--red)'}}></span>Causas de Improdutividade (Códigos)</div>
          {codigos.length === 0 ? <div style={{padding:20,textAlign:'center',color:'var(--gray)',fontSize:12}}>Sem dados de códigos para este mês.</div> :
            codigos.slice(0,8).map((c, i) => {
              const pct = (Number(c.total_horas)/maxCod*100).toFixed(0);
              const colors = ['var(--red)','var(--amber)','var(--blue)','var(--green)','var(--gray)'];
              return (
                <div key={i} style={{marginBottom:9}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                    <span style={{fontSize:10,color:'var(--gray)'}}>{c.codigo} — {c.descricao||'—'}</span>
                    <span style={{fontSize:11,fontWeight:700}}>{Number(c.total_horas).toFixed(0)}h</span>
                  </div>
                  <div style={{background:'var(--line)',borderRadius:4,height:8}}>
                    <div style={{width:`${pct}%`,background:colors[i%colors.length],height:8,borderRadius:4}}/>
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>
    </div>
  );
}
