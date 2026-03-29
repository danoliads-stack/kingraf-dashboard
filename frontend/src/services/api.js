import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
});

// Injeta token em todas as requisições
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('kingraf_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Redireciona para login se 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('kingraf_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authService = {
  login:         (email, senha) => api.post('/auth/login', { email, senha }),
  alterarSenha:  (dados) => api.post('/auth/alterar-senha', dados),
};

export const operadoresService = {
  listar:      (setor) => api.get('/operadores', { params: { setor } }),
  criar:       (dados) => api.post('/operadores', dados),
  desativar:   (id)    => api.patch(`/operadores/${id}/desativar`),
};

export const producaoService = {
  listar:  (params) => api.get('/producao', { params }),
  salvar:  (dados)  => api.post('/producao', dados),
  deletar: (id)     => api.delete(`/producao/${id}`),
};

export const dashboardService = {
  resumo:             (params) => api.get('/dashboard/resumo', { params }),
  ranking:            (params) => api.get('/dashboard/ranking', { params }),
  evolucao:           (params) => api.get('/dashboard/evolucao', { params }),
  improdoitivoCodigos:(params) => api.get('/dashboard/improdutivo-codigos', { params }),
  totalAnual:         (params) => api.get('/dashboard/total-anual', { params }),
  operador:           (id, params) => api.get(`/dashboard/operador/${id}`, { params }),
};

export const alertasService = {
  listar:      () => api.get('/alertas'),
  visualizar:  (id) => api.patch(`/alertas/${id}/visualizar`),
};

export const exportarService = {
  excel: (params) => api.get('/exportar/excel', { params, responseType: 'blob' }),
};

export const importarService = {
  preview: (file) => {
    const form = new FormData();
    form.append('arquivo', file);
    return api.post('/importar/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  salvar: (registros) => api.post('/importar/salvar', { registros }),
};

export default api;
