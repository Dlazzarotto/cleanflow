# CleanFlow AI — guia para o Claude Code

SaaS multiempresa para gestão de empresas de limpeza (residencial e comercial).
Dono: David Lazzarotto (CLEANFLOW APP LLC). Piloto: Wait Happy Cleaning Services Inc.
Idioma de trabalho com o David: **português**.

**Idioma do produto: o inglês é a língua base.** O público são donos de empresa de limpeza nos EUA que falam inglês, português, espanhol e francês — os quatro idiomas são suportados, mas o inglês é o padrão e os outros são escolha. Todo default de idioma no código e no banco é `'en'` (migration-52); `pt`/`es`/`fr` continuam válidos em todos os check constraints. Ao adicionar qualquer campo ou tela com idioma, o padrão é inglês.

Dois campos diferentes, não confundir:
- `clients.language` (e `estimates`/`commercial_estimates`) — idioma da **cliente final**: documentos, faturas, SMS e e-mail. Funciona.
- `user_settings.locale` — idioma da **interface** para o dono da empresa. O seletor existe em Configurações e grava no banco, mas nenhuma tela lê esse valor ainda: os textos estão escritos direto no JSX, em português. Ver pendências.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind · Supabase (Postgres + RLS + Storage) · Vercel
- Domínio: cleanflows.app · Email: Resend (no-reply@cleanflows.app) · SMS: Twilio · IA: Anthropic API (claude-sonnet-4-6)
- Repo: github.com/Dlazzarotto/cleanflow (main) · Local: `C:\Projetos\cleanflow` (fora do OneDrive — nunca voltar para lá, trava o Git)
- Deploy: `git push` → Vercel builda. Build passa por `tsc` estrito: qualquer erro de tipo derruba o deploy.

## Como o sistema está organizado

- `src/app/(app)/` telas autenticadas · `src/app/api/` rotas · `src/app/{fatura,inspecao,proposta,c,assine,instalar}/` páginas públicas (liberadas no `middleware.ts`)
- `src/lib/actions/*.ts` server actions · `src/lib/auth.ts` (`getAuth`, `requireManager`, `isManager`) · `src/lib/mode.ts` (modo residencial/comercial)
- `src/components/` componentes; `AppShell.tsx` é o menu (com ModeSwitcher e CompanySwitcher)
- `supabase/migration-NN-*.sql` — histórico numerado (última aplicada: verificar com o David). O David roda cada SQL no SQL Editor do Supabase manualmente.

### Multiempresa e papéis
- `memberships` liga usuário ↔ empresa com papel (owner/admin/supervisor/cleaner/marketing). `current_company_id()` e `is_manager()` no banco; RLS por `company_id` em tudo.
- Equipe de campo (cleaner) **jamais** vê valores/pagamentos — isso está no banco (views e RLS), não só na tela.
- `platform_admins` = David; painel `/admin`.

### Dois modos (migration-50)
- `user_settings.active_mode` ∈ residencial|comercial; `current_mode()` / `set_mode()`.
- Menus separados no `layout.tsx` (NAV_RESIDENCIAL / NAV_COMERCIAL). **Toda tela de listagem filtra pelo modo** (clientes por `client_type`; agendamentos/faturas/inspeções via ids dos clientes do modo; calendário via `/api/bookings`).
- Módulo comercial é assinatura à parte: `companies.commercial_enabled`; `has_commercial()`; trava no banco impede cliente comercial sem o módulo.

### Regras de negócio que já causaram incidentes
1. **`clients.default_price` é a fonte única do preço** (migrations 42-43). Mudou no cadastro → propaga para limpezas não pagas e faturas abertas. Exceção: `price_manual` na limpeza.
2. **Fatura só nasce após o serviço** (migration-44) — trigger no check-out; nunca para `scheduled_at` futuro. Vencimento conta da data da limpeza.
3. **Frequências**: semanal(7) / quinzenal(14) / tres_semanas(21) / mensal(28). Se tocar em uma, tocar em TODAS: telas, actions, tipos, traduções e check constraint do banco.
4. **Tempo estimado nunca aparece para o cliente** — só interno.
5. **Cliente "deletado" = banido** (motivo obrigatório, só owner, senha). Não é exclusão.
6. **O sistema nunca impede a equipe de trabalhar por configuração** — registra e sinaliza (migration-39).

## Regras de código — obrigatórias

- **Todo `.update()` termina em `.select('id')` e confere se veio linha.** RLS pode recusar em silêncio; o sistema já "fingiu sucesso" 44 vezes por isso. Sem linha → erro claro ao usuário.
- **Nunca `function nome() {}` dentro de bloco/closure** — o tsconfig alveja ES5 estrito e o build quebra. Use `const nome = () => {}`.
- **Antes de usar uma variável em JSX, declare-a.** Erros recentes: `temComercial`, `estimatesDoModo` usadas sem `const`.
- Imports sempre no topo, nunca inseridos dentro de um import multilinha.
- Componentes client precisam de `'use client'`; server actions de `'use server'`.
- Datas: fuso `America/New_York` (`src/lib/tz.ts`). Moeda USD, `maximumFractionDigits: 0` na UI.
- Textos da UI em português, tom direto, sem jargão técnico para a gestora.
- Acessibilidade mobile: alvos `min-h-touch`, `rounded-card`, paleta `brand-*` / `aqua-*` / `sun` (ver `tailwind.config`).

## Como o David quer receber entregas

- **Entrega completa, auditada e testada** — não patch parcial. "Ao mudar em um lugar, mudar em todos os equivalentes."
- Quando questionado, **auditar e revisar o conceito/código**, nunca defender o que está feito.
- **SQL sempre em arquivo `.sql` separado** em `supabase/`, numerado na sequência. Nunca colar SQL no chat.
- Antes de encerrar: rodar `npm run build` localmente. Se passar, `git add . && git commit -m "..." && git push`.
- Se precisar de decisão de negócio, perguntar antes de construir. Se for técnico, decidir e explicar em uma linha.

## Pendências abertas (ago/2026)

- **Interface multilíngue não existe.** `user_settings.locale` é gravado e nunca lido — o seletor de idioma em Configurações não traduz nada hoje. Como o público são donos que falam quatro idiomas, as telas precisam sair do português cravado no JSX para um dicionário indexado por `locale`. Trabalho grande (dezenas de arquivos); decidir escopo com o David antes de começar.
- Aplicar `cleanflow-sms-mensagens-v9` (caixa 💬 Mensagens, webhook STOP, consentimento): integrar `SmsConsentField` em `clientes/novo` e `clientes/[id]/editar` (gravar via `record_sms_consent` na action); migrar chamadas antigas `sendSms(tel, texto)` para `sendSms({companyId, clientId, to, body, kind})`.
- Twilio: toll-free verification da CLEANFLOW APP LLC; webhook `https://cleanflows.app/api/sms/webhook`.
- Lojas de app: D-U-N-S solicitado (aguardar); criar `david@cleanflows.app`; página da empresa no site + política de privacidade; Capacitor já configurado (`app.cleanflows.equipe`), app gratuito.
- Logo final (ondas aqua + bolha laranja) aguardando arquivos.
- Roadmap comercial: workloading fase 2 · checklist por turno com foto · suprimentos · rentabilidade por contrato · Stripe Connect.

## Verificação rápida de saúde do banco

```sql
select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and proname in
 ('current_company_id','is_manager','has_commercial','current_mode','can_send_sms','sms_unread_count');
```
Faltando alguma → a migration correspondente não rodou.
