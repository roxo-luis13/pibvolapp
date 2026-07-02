# Igreja App — PIBC

App de gestão de voluntários e ministérios da Primeira Igreja Batista de Campinas.

## Estrutura do projeto

```
pibvolapp/
├── index.html          # HTML principal
├── style.css           # Estilos
├── db.js               # Conexão Supabase
├── state.js            # Estado global
├── permissions.js      # Sistema de permissões
├── auth.js             # Login / logout / sessão
├── sidebar.js          # Menu lateral
├── navigate.js         # Navegação entre seções
├── dashboard.js        # Dashboard principal
├── calendario.js       # Calendário de eventos
├── ministerios.js      # Gestão de ministérios
├── niveis.js           # Níveis de acesso + pré-visualização
├── voluntarios.js      # Gestão de voluntários
├── eventos.js          # Criação e edição de eventos
├── perfil.js           # Perfil do usuário
├── notificacoes.js     # Sistema de notificações
└── utils.js            # Utilitários gerais
```

## Banco de dados
Supabase projeto: **PIBVolApp**  
URL: `https://knxdadcfphqadskwscya.supabase.co`

### Tabelas
- `voluntarios` — usuários e credenciais
- `ministerios` — ministérios da igreja
- `eventos` — eventos com datas, horários e locais
- `notificacoes` — convites e notificações
- `niveis_acesso` — permissões configuráveis

## Deploy
GitHub Pages: https://roxo-luis13.github.io/pibvolapp
