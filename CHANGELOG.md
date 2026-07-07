# Changelog — Igreja App PIBC

## v0.0 — Estado base
**Data:** 2026-07-07

### Funcionalidades incluídas
- Autenticação própria (email + senha SHA-256, primeiro acesso, esqueci senha)
- Dashboard personalizado por nível (métricas, ministérios clicáveis, próximos eventos, eventos que precisam de voluntários)
- Calendário com vista grade e agenda mobile, clique por dia, detalhes de evento
- Ministérios: CRUD, líder, voluntários, eventos vinculados
- Voluntários: CRUD, filtros, cards mobile
- Eventos: CRUD, datas múltiplas, horários por dia, local, live, som, banda, convites
- Perfil: editar dados, alterar senha, escolher ministérios
- Notificações: convites de eventos com aceitar/recusar
- Níveis de acesso: 5 níveis (Admin, Pastor, Líder, Líder de Banda, Voluntário)
  - Permissões granulares por área (ministérios, voluntários, eventos, visibilidade)
  - Pré-visualização de qualquer nível
  - Líder edita apenas o ministério que lidera
  - Pastor não acessa tela de níveis
- Versionamento com tags GitHub
- Otimização mobile completa (cards, agenda, swipe sidebar, PWA)
- Deploy automático via GitHub Pages

---

## Como restaurar uma versão anterior

No terminal com o repositório clonado:

```bash
# Ver todas as versões disponíveis
git tag

# Restaurar para uma versão específica (ex: v0.0)
git checkout v0.0

# Voltar para a versão mais recente
git checkout main
```

Ou pelo GitHub: vá em **Releases/Tags** e baixe o ZIP da versão desejada.
