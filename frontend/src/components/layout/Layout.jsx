import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Scissors, Package, PlusCircle, Download, Bell, LogOut, Settings, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { alertasService } from '../../services/api';

export default function Layout() {
  const navigate    = useNavigate();
  const usuario     = JSON.parse(localStorage.getItem('kingraf_user') || '{}');
  const [alertas, setAlertas] = useState([]);

  useEffect(() => {
    alertasService.listar().then(r => setAlertas(r.data)).catch(() => {});
  }, []);

  const logout = () => {
    localStorage.removeItem('kingraf_token');
    localStorage.removeItem('kingraf_user');
    navigate('/login');
  };

  const iniciais = usuario.nome?.split(' ').slice(0,2).map(n=>n[0]).join('') || 'KG';

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>Kingraf</h1>
          <p>Sistema de Produtividade</p>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">Dashboard</div>
          <NavLink to="/overview"  className={({isActive})=>`nav-item${isActive?' active':''}`}>
            <LayoutDashboard size={16}/> Visão Geral
          </NavLink>
          <NavLink to="/corte"     className={({isActive})=>`nav-item${isActive?' active':''}`}>
            <Scissors size={16}/> Corte e Vinco
          </NavLink>
          <NavLink to="/colagem"   className={({isActive})=>`nav-item${isActive?' active':''}`}>
            <Package size={16}/> Colagem
          </NavLink>
          <NavLink to="/operadores" className={({isActive})=>`nav-item${isActive?' active':''}`}>
            <Users size={16}/> Operadores
          </NavLink>

          <div className="nav-section">Gestao</div>
          <NavLink to="/alimentar" className={({isActive})=>`nav-item${isActive?' active':''}`}>
            <PlusCircle size={16}/> Alimentar Dados
          </NavLink>
          <NavLink to="/exportar"  className={({isActive})=>`nav-item${isActive?' active':''}`}>
            <Download size={16}/> Exportar
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{iniciais}</div>
            <div style={{flex:1,overflow:'hidden'}}>
              <div className="user-name" style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{usuario.nome || 'Usuário'}</div>
              <div className="user-role">{usuario.perfil === 'diretoria' ? 'Diretoria' : 'Supervisor'}</div>
            </div>
            <button onClick={logout} style={{background:'none',border:'none',cursor:'pointer',color:'#888',padding:'4px'}} title="Sair">
              <LogOut size={15}/>
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:13,color:'var(--gray)'}}>Kingraf Indústria Gráfica</span>
            <span style={{fontSize:11,background:'var(--orange-l)',color:'var(--orange)',padding:'2px 8px',borderRadius:10,fontWeight:700}}>2026</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            {alertas.length > 0 && (
              <div style={{position:'relative',cursor:'pointer'}}>
                <Bell size={18} color="var(--gray)"/>
                <span style={{position:'absolute',top:-4,right:-4,background:'var(--red)',color:'white',borderRadius:'50%',width:16,height:16,fontSize:9,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>
                  {alertas.length}
                </span>
              </div>
            )}
            <span style={{fontSize:12,color:'var(--gray)'}}>
              {new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})}
            </span>
          </div>
        </header>

        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
