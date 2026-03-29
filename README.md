# Kingraf Dashboard — Sistema de Produtividade

Dashboard completo para acompanhamento de produtividade dos setores de **Corte e Vinco** e **Colagem**.

---

## Pré-requisitos

- [Node.js 18+](https://nodejs.org/)
- [PostgreSQL 14+](https://www.postgresql.org/download/)
- [VS Code](https://code.visualstudio.com/)

---

## Instalação — Passo a Passo

### 1. Clone / abra no VS Code
Abra a pasta `kingraf-dashboard` no VS Code.

### 2. Configure o banco de dados
```bash
# Acesse o PostgreSQL
psql -U postgres

# Crie o banco
CREATE DATABASE kingraf;
\q

# Rode as migrations
cd backend
npm install
npm run migrate
```

### 3. Configure as variáveis de ambiente
```bash
# backend/.env
cp backend/.env.example backend/.env
# Edite com suas credenciais do PostgreSQL
```

### 4. Instale e rode o backend
```bash
cd backend
npm install
npm run dev
# Roda em http://localhost:3001
```

### 5. Instale e rode o frontend
```bash
# Em outro terminal
cd frontend
npm install
npm run dev
# Abre em http://localhost:5173
```

---

## Estrutura do Projeto

```
kingraf-dashboard/
├── backend/
│   ├── src/
│   │   ├── routes/        # Rotas da API
│   │   ├── controllers/   # Lógica de negócio
│   │   ├── models/        # Queries do banco
│   │   └── middleware/    # Auth, validação
│   ├── config/
│   │   └── database.js    # Conexão PostgreSQL
│   └── migrations/        # Criação das tabelas
├── frontend/
│   ├── src/
│   │   ├── components/    # Componentes React
│   │   ├── pages/         # Páginas do dashboard
│   │   ├── services/      # Chamadas à API
│   │   └── hooks/         # Hooks customizados
│   └── public/
└── README.md
```

---

## Funcionalidades

- Dashboard com KPIs em tempo real
- Ranking de operadores por pontuação combinada
- Gráficos de evolução mensal
- Alertas automáticos por Hi/Ht
- Alimentação de dados manual ou via upload de PDF
- Exportação em PDF executivo e Excel
- Controle de acesso (supervisor / diretoria)

---

## Acesso

| Perfil | Usuário | Senha padrão |
|--------|---------|--------------|
| Supervisor | daniel.oliveira | kingraf2026 |
| Diretoria | diretoria | kingraf2026 |

> Altere as senhas no primeiro acesso em Configurações.
