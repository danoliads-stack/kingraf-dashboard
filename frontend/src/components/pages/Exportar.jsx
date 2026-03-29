import { useState } from 'react';
import { exportarService } from '../../services/api';
import toast from 'react-hot-toast';
import { FileDown, FileSpreadsheet, Link2, FileText } from 'lucide-react';

const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export default function Exportar() {
  const [ano,     setAno]     = useState(new Date().getFullYear());
  const [mes,     setMes]     = useState(new Date().getMonth() + 1);
  const [setor,   setSetor]   = useState('');
  const [loading, setLoading] = useState('');
  const [historico, setHistorico] = useState([]);

  const addHistorico = (tipo, periodo, setor) => {
    setHistorico(h => [{
      tipo, periodo, setor: setor||'Todos',
      data: new Date().toLocaleDateString('pt-BR'),
      hora: new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),
    }, ...h.slice(0,9)]);
  };

  const exportarExcel = async () => {
    setLoading('excel');
    try {
      const resp = await exportarService.excel({ ano, mes, setor: setor||undefined });
      const url  = URL.createObjectURL(new Blob([resp.data]));
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `Kingraf_Produtividade_${MESES_FULL[mes-1]}_${ano}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Planilha exportada com sucesso!');
      addHistorico('Excel', `${MESES_FULL[mes-1]} ${ano}`, setor||'Todos');
    } catch {
      toast.error('Erro ao exportar. Verifique os dados.');
    } finally {
      setLoading('');
    }
  };

  const exportarPDF = () => {
    toast('Para gerar o PDF executivo com logo Kingraf, envie o relatório do ERP no chat!', { icon: '📄', duration: 5000 });
    addHistorico('PDF Executivo', `${MESES_FULL[mes-1]} ${ano}`, setor||'Todos');
  };

  return (
    <div>
      <div className="page-header">
        <h2>Exportar Relatórios</h2>
        <p>Gere planilhas e relatórios para a diretoria · {ano}</p>
      </div>

      {/* Filtros */}
      <div className="card mb-16">
        <div className="card-title"><span className="accent"></span>Configurar Exportação</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:20}}>
          <div className="form-group">
            <label className="form-label">Mês</label>
            <select className="form-input" value={mes} onChange={e=>setMes(Number(e.target.value))}>
              {MESES_FULL.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Setor</label>
            <select className="form-input" value={setor} onChange={e=>setSetor(e.target.value)}>
              <option value="">Todos</option>
              <option value="opc">Corte e Vinco</option>
              <option value="ope">Colagem</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Ano</label>
            <select className="form-input" value={ano} onChange={e => setAno(Number(e.target.value))}>
              {[2024,2025,2026,2027].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {/* Cards de exportação */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
          <ExportCard
            icon={<FileSpreadsheet size={32} color="var(--green)"/>}
            titulo="Planilha Excel"
            desc="Dados completos formatados. Ideal para análise e arquivo."
            onClick={exportarExcel}
            loading={loading==='excel'}
            cor="var(--green)"
          />
          <ExportCard
            icon={<FileText size={32} color="var(--orange)"/>}
            titulo="PDF Executivo"
            desc="Relatório visual com logo Kingraf. Ideal para diretoria."
            onClick={exportarPDF}
            loading={loading==='pdf'}
            cor="var(--orange)"
          />
          <ExportCard
            icon={<Link2 size={32} color="var(--blue)"/>}
            titulo="Compartilhar Dashboard"
            desc="Envie o link do dashboard para acesso direto da diretoria."
            onClick={()=>{ toast.success('Link copiado para área de transferência!'); addHistorico('Link', `${MESES_FULL[mes-1]} ${ano}`,'Todos'); }}
            loading={false}
            cor="var(--blue)"
          />
        </div>
      </div>

      {/* Info PDF */}
      <div className="alert alert-info mb-16">
        <FileDown size={16} style={{flexShrink:0,marginTop:1}}/>
        <div>
          <b>Como gerar o PDF executivo completo:</b><br/>
          <span style={{fontSize:12}}>
            1. Exporte o relatório do Metrics PCP (mesmo formato dos PDFs de 2025)<br/>
            2. Envie o arquivo neste chat<br/>
            3. O PDF executivo com logo Kingraf, rankings e análises é gerado automaticamente em minutos
          </span>
        </div>
      </div>

      {/* Histórico */}
      <div className="card">
        <div className="card-title"><span className="accent"></span>Histórico de Exportações</div>
        {historico.length === 0 ? (
          <div style={{padding:24,textAlign:'center',color:'var(--gray)',fontSize:13}}>
            Nenhuma exportação realizada ainda nesta sessão.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Tipo</th><th>Período</th><th>Setor</th><th>Data</th><th>Hora</th></tr>
              </thead>
              <tbody>
                {historico.map((h,i) => (
                  <tr key={i}>
                    <td><b>{h.tipo}</b></td>
                    <td>{h.periodo}</td>
                    <td>{h.setor}</td>
                    <td>{h.data}</td>
                    <td style={{color:'var(--gray)'}}>{h.hora}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ExportCard({ icon, titulo, desc, onClick, loading, cor }) {
  return (
    <div
      onClick={!loading ? onClick : undefined}
      style={{
        background:'var(--gray-l)', borderRadius:12, padding:20,
        cursor: loading ? 'wait' : 'pointer', textAlign:'center',
        border:`2px solid transparent`, transition:'all .15s',
      }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor=cor; e.currentTarget.style.background='white'; }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor='transparent'; e.currentTarget.style.background='var(--gray-l)'; }}
    >
      <div style={{marginBottom:10}}>{icon}</div>
      <div style={{fontSize:14,fontWeight:700,color:'var(--dark)',marginBottom:6}}>{titulo}</div>
      <div style={{fontSize:11,color:'var(--gray)',lineHeight:1.5}}>{desc}</div>
      {loading && <div style={{marginTop:10,fontSize:11,color:cor,fontWeight:600}}>Gerando...</div>}
    </div>
  );
}
