import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout   from './components/layout/Layout';
import Login    from './components/pages/Login';
import Overview from './components/pages/Overview';
import CorteVinco from './components/pages/CorteVinco';
import Colagem  from './components/pages/Colagem';
import Alimentar from './components/pages/Alimentar';
import Exportar from './components/pages/Exportar';
import Operadores from './components/pages/Operadores';
import './index.css';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('kingraf_token');
  return token ? children : <Navigate to="/login" />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/overview" />} />
          <Route path="overview"  element={<Overview />} />
          <Route path="corte"     element={<CorteVinco />} />
          <Route path="colagem"   element={<Colagem />} />
          <Route path="operadores" element={<Operadores />} />
          <Route path="alimentar" element={<Alimentar />} />
          <Route path="exportar"  element={<Exportar />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
