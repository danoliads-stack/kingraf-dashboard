import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { dashboardService } from '../../services/api';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const ANO_OPTIONS = [2024, 2025, 2026, 2027];

function fmt(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n/1e6).toFixed(2)+' M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+' k';
  return n.toFixed(0);
}

export default function Overview() {
  const [ano, setAno]         = useState(new Date().getFullYear());
  const [mes, setMes]         = useState(-1); // -1 = Total Ano
  const [resumo, setResumo]   = useState([]);
  const [evolucao, setEvolucao] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      dashboardService.resumo(mes >= 0 ? { ano, mes: mes + 1 } : { ano }),
      dashboardService.evolucao({ ano }),
    ]).then(([r, e]) => {
      setResumo(r.data);
      setEvolucao(e.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [mes, ano]);

  const opc = resumo.find(r => r.setor === 'opc') || {};
  const ope = resumo.find(r => r.setor === 'ope') || {};

  const totGiros  = (Number(opc.giros_totais)||0) + (Number(ope.giros_totais)||0);
  const totProd   = (Number(opc.h_produtivas)||0) + (Number(ope.h_produtivas)||0);
  const totImprod = (Number(opc.h_improdutivas)||0) + (Number(ope.h_improdutivas)||0);
  const totAcerto = (Number(opc.h_acerto)||0) + (Number(ope.h_acerto)||0);
  const totH      = totProd + totImprod + totAcerto;
  const hihtGeral = totH > 0 ? (totImprod / totH * 100) : 0;

  const hihtOPC   = (() => {
    const t = (Number(opc.h_produtivas)||0)+(Number(opc.h_acerto)||0)+(Number(opc.h_improdutivas)||0);
    return t > 0 ? ((Number(opc.h_improdutivas)||0)/t*100) : 0;
  })();
  const hihtOPE   = (() => {
    const t = (Number(ope.h_produtivas)||0)+(Number(ope.h_acerto)||0)+(Number(ope.h_improdutivas)||0);
    return t > 0 ? ((Number(ope.h_improdutivas)||0)/t*100) : 0;
  })();

  const evolData = MESES.map((m, i) => {
    const d = evolucao.find(e => Number(e.mes) === i+1) || {};
    return {
      mes: m,
      'H. Produtivas': Number(d.h_produtivas)||0,
      'H. Acerto':     Number(d.h_acerto)||0,
      'H. Improdutivo':Number(d.h_improdutivas)||0,
      'Hi/Ht %':       Number(d.hiht)||0,
    };
  });

  return (
    <div>
      <div className="page-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h2>Visão Geral</h2>
          <p>Indicadores consolidados — Corte e Vinco + Colagem · {ano}</p>
        </div>
        <select className="form-input" style={{width:100}} value={ano} onChange={e => setAno(Number(e.target.value))}>
          {ANO_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Seletor de mês */}
      <div className="month-pills">
        <button className={`month-pill ${mes===-1?'active':''}`} onClick={()=>setMes(-1)} style={mes===-1?{fontWeight:700}:{}}>Total Ano</button>
        {MESES.map((m, i) => (
          <button
            key={i}
            className={`month-pill ${i === mes ? 'active' : ''}`}
            onClick={() => setMes(i)}
          >{m}</button>
        ))}
      </div>

      {/* Alertas */}
      {hihtOPC > 45 && (
        <div className="alert alert-danger mb-16">
          <AlertTriangle size={16} style={{flexShrink:0,marginTop:1}}/>
          <span><b>Corte e Vinco</b> — Hi/Ht em <b>{hihtOPC.toFixed(1)}%</b> em {mes >= 0 ? MESES_FULL[mes] : `Total ${ano}`}. Acima do limite de 45%.</span>
        </div>
      )}
      {hihtOPE > 80 && (
        <div className="alert alert-warn mb-16">
          <AlertTriangle size={16} style={{flexShrink:0,marginTop:1}}/>
          <span><b>Colagem</b> — Hi/Ht em <b>{hihtOPE.toFixed(1)}%</b>. Verifique apontamento (código 911).</span>
        </div>
      )}
      {!loading && totGiros === 0 && (
        <div className="alert alert-info mb-16">
          <CheckCircle size={16} style={{flexShrink:0,marginTop:1}}/>
          <span>Nenhum dado registrado para <b>{mes >= 0 ? MESES_FULL[mes] : `Total ${ano}`} {ano}</b>. Vá em <b>Alimentar Dados</b> para adicionar.</span>
        </div>
      )}

      {/* KPIs */}
      <div className="kpi-grid mb-20">
        <div className="kpi-card">
          <div className="kpi-label">Total de Giros</div>
          <div className="kpi-value">{fmt(totGiros)}</div>
          <div className="kpi-sub">Ambos os setores</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-label">H. Produtivas</div>
          <div className="kpi-value">{totProd.toFixed(0)}h</div>
          <div className="kpi-sub">Tempo efetivo</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-label">H. Improdutivas</div>
          <div className="kpi-value">{totImprod.toFixed(0)}h</div>
          <div className="kpi-sub" style={{color: hihtGeral>45?'var(--red)':'var(--gray)'}}>
            Hi/Ht: <b>{hihtGeral.toFixed(1)}%</b>
          </div>
        </div>
        <div className="kpi-card blue">
          <div className="kpi-label">H. Acerto</div>
          <div className="kpi-value">{totAcerto.toFixed(0)}h</div>
          <div className="kpi-sub">Tempo de setup</div>
        </div>
      </div>

      {/* Distribuição por setor */}
      <div className="grid-2 mb-16">
        <DistCard titulo="Corte e Vinco" dados={opc} cor="var(--orange)" />
        <DistCard titulo="Colagem" dados={ope} cor="var(--amber)" />
      </div>

      {/* Evolução mensal */}
      <div className="card mb-16">
        <div className="card-title">
          <span><span className="accent"></span>Evolução Mensal — Horas (Barras) e Hi/Ht % (Linha)</span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={evolData} margin={{top:4,right:16,left:0,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="mes" tick={{fontSize:11}} />
            <YAxis yAxisId="left" tick={{fontSize:11}} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={v=>v+'%'} tick={{fontSize:11}} domain={[0,100]} />
            <Tooltip formatter={(v,n) => [typeof v==='number'?v.toFixed(1)+(n.includes('%')?'%':'h'):v, n]} />
            <Legend wrapperStyle={{fontSize:11}} />
            <Bar yAxisId="left" dataKey="H. Produtivas"  stackId="a" fill="#1D9E75" />
            <Bar yAxisId="left" dataKey="H. Acerto"      stackId="a" fill="#185FA5" />
            <Bar yAxisId="left" dataKey="H. Improdutivo" stackId="a" fill="#E24B4A" />
            <Line yAxisId="right" type="monotone" dataKey="Hi/Ht %" stroke="var(--orange)" strokeWidth={2.5} dot={{r:4}} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Comparativo setores */}
      <div className="card">
        <div className="card-title"><span className="accent"></span>Comparativo Setores — {mes >= 0 ? MESES_FULL[mes] : `Total ${ano}`}</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Setor</th>
                <th>Giros Totais</th>
                <th>H. Produtivas</th>
                <th>H. Acerto</th>
                <th>H. Improdutivas</th>
                <th>Hi/Ht %</th>
                <th>Vel. Média</th>
                <th>Distribuição</th>
              </tr>
            </thead>
            <tbody>
              {[{label:'Corte e Vinco',d:opc,hiht:hihtOPC},{label:'Colagem',d:ope,hiht:hihtOPE}].map(({label,d,hiht})=>{
                const t=(Number(d.h_produtivas)||0)+(Number(d.h_acerto)||0)+(Number(d.h_improdutivas)||0);
                const pP=t>0?((Number(d.h_produtivas)||0)/t*100).toFixed(0):0;
                const pA=t>0?((Number(d.h_acerto)||0)/t*100).toFixed(0):0;
                const pI=t>0?((Number(d.h_improdutivas)||0)/t*100).toFixed(0):0;
                return (
                  <tr key={label}>
                    <td><b>{label}</b></td>
                    <td>{fmt(d.giros_totais)}</td>
                    <td style={{color:'var(--green)',fontWeight:600}}>{(Number(d.h_produtivas)||0).toFixed(0)}h</td>
                    <td style={{color:'var(--blue)',fontWeight:600}}>{(Number(d.h_acerto)||0).toFixed(0)}h</td>
                    <td style={{color:'var(--red)',fontWeight:600}}>{(Number(d.h_improdutivas)||0).toFixed(0)}h</td>
                    <td><span style={{color:hiht>45?'var(--red)':hiht>30?'var(--amber)':'var(--green)',fontWeight:700}}>{hiht.toFixed(1)}%</span></td>
                    <td>{(Number(d.velocidade_media)||0).toFixed(0).toLocaleString()}</td>
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DistCard({ titulo, dados, cor }) {
  const t = (Number(dados.h_produtivas)||0)+(Number(dados.h_acerto)||0)+(Number(dados.h_improdutivas)||0);
  const pP = t>0?((Number(dados.h_produtivas)||0)/t*100).toFixed(1):0;
  const pA = t>0?((Number(dados.h_acerto)||0)/t*100).toFixed(1):0;
  const pI = t>0?((Number(dados.h_improdutivas)||0)/t*100).toFixed(1):0;
  return (
    <div className="card">
      <div className="card-title">
        <span><span className="accent" style={{background:cor}}></span>{titulo}</span>
        <span style={{fontSize:12,color:'var(--gray)',fontWeight:400}}>{(Number(dados.num_operadores)||0)} operadores</span>
      </div>
      <div className="stacked-bar" style={{height:18,borderRadius:8,marginBottom:12}}>
        <div style={{width:`${pP}%`,background:'var(--green)'}}/>
        <div style={{width:`${pA}%`,background:'var(--blue)'}}/>
        <div style={{width:`${pI}%`,background:'var(--red)'}}/>
      </div>
      <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
        <Leg color="var(--green)" label={`Produtivas ${pP}%`} valor={`${(Number(dados.h_produtivas)||0).toFixed(0)}h`} />
        <Leg color="var(--blue)"  label={`Acerto ${pA}%`}     valor={`${(Number(dados.h_acerto)||0).toFixed(0)}h`} />
        <Leg color="var(--red)"   label={`Improd. ${pI}%`}    valor={`${(Number(dados.h_improdutivas)||0).toFixed(0)}h`} />
      </div>
    </div>
  );
}

function Leg({ color, label, valor }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <div style={{width:10,height:10,borderRadius:2,background:color,flexShrink:0}}/>
      <span style={{fontSize:11,color:'var(--gray)'}}>{label}</span>
      <span style={{fontSize:11,fontWeight:700,color:'var(--dark)'}}>{valor}</span>
    </div>
  );
}
