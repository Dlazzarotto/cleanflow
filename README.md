# CleanFlow AI — Fase 1 (MVP)

> A primeira plataforma que administra uma empresa de limpeza praticamente sozinha.

Fundação SaaS multi-tenant construída em **Next.js 14 (App Router) + Supabase + TypeScript + Tailwind**, pronta para deploy na **Vercel**.

## O que está incluído nesta fase

| Módulo | Status |
|---|---|
| Autenticação (email/senha) + isolamento por empresa (RLS) | ✅ Completo |
| CRM de clientes (ficha completa: código da porta, pets, alarme, preferências, produtos, frequência) | ✅ Completo |
| Agendamentos com fluxo de status (Agendado → A caminho → Check-in → Check-out) | ✅ Completo |
| Equipes | ✅ Completo |
| Dashboard (limpezas do dia, receita do mês, clientes ativos, cancelamentos) | ✅ Completo |
| Bot IA (canal web, orçamentos automáticos via Anthropic API, histórico persistido) | ✅ Base funcional |
| Pagamentos | 🔜 Fase 2 (tabela `payments` já criada) |
| Roteirização / GPS / Portal do cliente / Portal do funcionário | 🔜 Fases seguintes |

## Setup

### 1. Supabase
1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, execute o conteúdo de `supabase/schema.sql`.
3. Em **Authentication → Providers**, mantenha Email habilitado.
4. Crie o primeiro usuário em **Authentication → Users → Add user**.
5. Rode o seed no final do `schema.sql` substituindo o UUID do usuário criado — isso cria a empresa e vincula o perfil.

### 2. Variáveis de ambiente
Copie `.env.example` para `.env.local` e preencha:
- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Settings → API do Supabase)
- `ANTHROPIC_API_KEY` (console.anthropic.com) — necessária apenas para o bot (`/api/bot`)

### 3. Rodar localmente
```bash
npm install
npm run dev
```
Acesse http://localhost:3000 — você será redirecionado para `/login`.

### 4. Deploy na Vercel
1. Suba o repositório para o GitHub.
2. Importe na Vercel e adicione as 3 variáveis de ambiente.
3. Deploy.

## Bot IA — como testar
```bash
curl -X POST http://localhost:3000/api/bot \
  -H "Content-Type: application/json" \
  -d '{"message": "Preciso limpar minha casa"}'
```
A resposta retorna `{ reply, conversationId }`. Envie o `conversationId` nas próximas mensagens para manter o contexto. O histórico fica em `bot_conversations`.

## Arquitetura multi-tenant
- Cada empresa de limpeza = 1 registro em `companies`.
- Todo usuário (`profiles`) pertence a uma empresa, com papel: `owner`, `admin`, `supervisor` ou `cleaner`.
- **RLS em todas as tabelas**: a função `current_company_id()` garante que nenhum dado vaza entre empresas — é isso que permite vender o sistema por assinatura para várias empresas no mesmo banco.

## Estrutura
```
src/
  app/
    login/                  # Autenticação
    (app)/                  # Área autenticada
      dashboard/            # KPIs + agenda do dia
      clientes/             # CRM (lista, novo, detalhe)
      agendamentos/         # Lista + nova limpeza + fluxo de status
      equipes/              # Cadastro de equipes
    api/
      bot/                  # Bot IA (Anthropic API)
      logout/
  lib/
    actions/                # Server Actions (CRUD)
    supabase/               # Clients browser/server
    types.ts
supabase/
  schema.sql                # Schema completo + RLS + seed
```

## Roadmap sugerido (próximas fases)
1. **Fase 2 — Cobrança**: Stripe Checkout + webhook, mensagem automática pós check-out, assinaturas recorrentes.
2. **Fase 3 — Operação**: portal do funcionário (agenda + check-in por GPS + fotos), checklist por cômodo.
3. **Fase 4 — Bot com ações**: tool use no bot para agendar/reagendar/cancelar direto no banco; canal WhatsApp/SMS via Twilio.
4. **Fase 5 — Logística**: roteirização (Google Routes API), mapa em tempo real, reorganização automática de agenda.
5. **Fase 6 — Inteligência**: promoções automáticas, predição de churn, BI, IA administrativa.
