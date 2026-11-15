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
├── suporte.js          # Suporte técnico (roteiros, problemas e soluções)
├── assistente.js       # Assistente de IA (modo geral e "Voluntário IA")
├── supabase/           # Código das Edge Functions e migrações SQL
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
- `suporte_procedimentos` — roteiros de ligar/desligar som, transmissão e multimídia (por local)
- `suporte_problemas` — base de problemas e soluções (voluntário registra, líder aprova)

## Suporte técnico
Seção visível para todos os voluntários:
- **Ligar e desligar**: roteiros passo a passo em modo checklist (Salão Principal). Só admin, pastor e líder editam.
- **Problemas e soluções**: qualquer voluntário reporta; o registro só aparece para todos (e para a IA) depois que um líder aprova. Líderes recebem notificação.
- **Voluntário IA**: o assistente flutuante entra em "modo suporte" nessa seção e responde só com base nos problemas aprovados e nos roteiros. Se não houver registro parecido, ele avisa e, quando o voluntário diz que deu certo, pede para registrar o problema e a solução.

## Deploy
GitHub Pages: https://roxo-luis13.github.io/pibvolapp
