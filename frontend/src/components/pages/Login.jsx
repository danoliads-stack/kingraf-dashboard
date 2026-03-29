import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/api';
import toast from 'react-hot-toast';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', senha: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authService.login(form.email, form.senha);
      localStorage.setItem('kingraf_token', data.token);
      localStorage.setItem('kingraf_user', JSON.stringify(data.usuario));
      toast.success(`Bem-vindo, ${data.usuario.nome.split(' ')[0]}!`);
      navigate('/overview');
    } catch (err) {
      if (!err.response) {
        toast.error('Servidor não encontrado. Verifique se o backend está rodando na porta 3001.');
      } else if (err.response.status === 401) {
        toast.error('Usuário ou senha inválidos.');
      } else {
        const msg = err.response?.data?.erro || err.response?.data?.message || JSON.stringify(err.response?.data) || err.message;
        toast.error(`Erro no servidor (${err.response.status}): ${msg}`, { duration: 8000 });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--dark)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:380 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <h1 style={{ fontSize:38, fontWeight:900, color:'var(--orange)', letterSpacing:-1 }}>Kingraf</h1>
          <p style={{ color:'#888', fontSize:13, marginTop:4 }}>Sistema de Produtividade</p>
        </div>

        {/* Card */}
        <div style={{ background:'#222', borderRadius:14, padding:32, border:'1px solid #333' }}>
          <h2 style={{ color:'white', fontSize:18, fontWeight:700, marginBottom:6 }}>Entrar</h2>
          <p style={{ color:'#777', fontSize:12, marginBottom:24 }}>Acesse o dashboard de produtividade</p>

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="form-group">
              <label className="form-label" style={{ color:'#aaa' }}>E-mail</label>
              <input
                className="form-input"
                style={{ background:'#2a2a2a', borderColor:'#444', color:'white' }}
                type="email"
                placeholder="seu@email.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color:'#aaa' }}>Senha</label>
              <input
                className="form-input"
                style={{ background:'#2a2a2a', borderColor:'#444', color:'white' }}
                type="password"
                placeholder="••••••••"
                value={form.senha}
                onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width:'100%', justifyContent:'center', padding:'10px', fontSize:14, marginTop:4 }}
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar no Sistema'}
            </button>
          </form>

          <div style={{ marginTop:20, padding:14, background:'#1a1a1a', borderRadius:8, fontSize:11, color:'#666' }}>
            <div style={{ marginBottom:4 }}><b style={{color:'#888'}}>Supervisor:</b> daniel.oliveira@kingraf.com.br</div>
            <div><b style={{color:'#888'}}>Diretoria:</b> diretoria@kingraf.com.br</div>
            <div style={{ marginTop:4 }}><b style={{color:'#888'}}>Senha padrão:</b> kingraf2026</div>
          </div>
        </div>

        <p style={{ textAlign:'center', color:'#555', fontSize:11, marginTop:16 }}>
          Kingraf Indústria Gráfica © 2026
        </p>
      </div>
    </div>
  );
}
