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
- `memberships` liga usuário ↔ empresa com papel. **Lista única em `src/lib/roles.ts`** — nunca repetir os nomes em tela; o banco tem a mesma lista no check constraint e em `is_admin()`/`is_manager()`/`is_field()` (migration-55).
- **Papéis**: `admin` (quem abre a empresa — acesso total, único que concede permissão) · `manager` (escritório: agenda e equipes) · `supervisor` (campo: cuida das equipes) · `motorista`/`helper`/`outros` (equipe) · `marketing` (**não é da equipe** — pessoa/empresa de fora que só cadastra lead e vê o que ela mesma cadastrou; escopo na migration-20).
- Nomes antigos: `owner`→`admin`, `admin` velho→`manager`, `cleaner`→`helper`. `admin` é nome válido nos dois modelos, então a migration-55 é guardada pelo constraint.
- **Valores não vêm do papel.** `can_see_values()` = admin sempre; manager/supervisor só se o admin ligar `memberships.can_see_values` (nasce desligada); equipe e marketing nunca. `guard_membership_admin()` impede auto-liberação.
- **Preço**: a view `clients_safe` (migration-56) mascara `default_price` e `monthly_contract_value`; **toda leitura de cliente usa a view, escrita usa a tabela** (a view tem coluna calculada e não aceita insert/update). `guard_client_price()` barra a escrita sem permissão. Coluna de dinheiro nova em `clients` → acrescentar na lista da 56 e rodar de novo.
- **A empresa nunca fica sem admin**: `guard_last_admin()` recusa rebaixar, desativar ou apagar o último admin ativo. Mais de um admin é permitido (sócios) e cada um ocupa uma vaga do plano.
- **Escopo por equipe**: manager/supervisor veem as equipes em que estão (`team_members`); quem não tem nenhuma atribuída vê todas — é o caso do escritório. `sees_team()` decide.
- `current_company_id()` e `is_manager()` no banco; RLS por `company_id` em tudo.
- Equipe de campo (cleaner) **jamais** vê valores/pagamentos — isso está no banco (views e RLS), não só na tela.
- `platform_admins` = David; painel `/admin`.

### Dois modos (migration-50)
- `user_settings.active_mode` ∈ residencial|comercial; `current_mode()` / `set_mode()`.
- Menus separados no `layout.tsx` (NAV_RESIDENCIAL / NAV_COMERCIAL). **Toda tela de listagem filtra pelo modo** (clientes por `client_type`; agendamentos/faturas/inspeções via ids dos clientes do modo; calendário via `/api/bookings`).
- Comercial é o que define o plano **Plus** (migration-53). `has_commercial()` = `plan = 'plus' or commercial_enabled`; trava no banco impede cliente comercial sem isso. `commercial_enabled` deixou de ser assinatura à parte e virou só exceção manual (liberar comercial para quem está no Base/Pro).

### Planos (migration-53)
- **Base** $30 · só residencial · 1 equipe
- **Pro** $60 · só residencial · 2 equipes · relatórios
- **Plus** $90 · residencial + comercial · 3 equipes
- **Acesso é ilimitado nos três planos.** Um login a mais não custa nada à plataforma (diferente de SMS), então a empresa decide: uma conta compartilhada por equipe, ou uma por pessoa. Com login por pessoa, `work_shifts` volta a ter nome na jornada. Quem sai fica em hold (`memberships.active = false`) e volta sem perder histórico.
- Equipe adicional: $19,99/mês em qualquer plano, **com teto de mensalidade**: Base para em $100, Pro em $150, **Plus sem teto**. `monthlyFee()` e `company_monthly_fee()` aplicam. O Plus não tem teto de propósito — quem cresce muito está lá, e ali crescimento vira receita.
- **As travas rodam no banco, não na tela**: `company_max_teams()`, `company_monthly_fee()`, `has_commercial()`, `has_reports()` e o trigger `teams_plan_limit`.
- Os mesmos números estão em `src/lib/plans.ts` (para exibir). **Mudou num lugar → mudar no outro**, senão a tela promete o que o banco recusa.
- **Cliente e acesso são ilimitados nos três planos.** Limitar qualquer um dos dois pune quem cresce, e o concorrente direto vende "Unlimited Clients" e "Unlimited Users". **A única coisa com teto é equipe** — é o eixo que reflete tamanho de operação de verdade. `company_max_clients()` e `company_max_users()` seguem existindo devolvendo `null`; se um dia voltar teto, muda ali e em `plans.ts`.
- **Permissão é por pessoa, não por cargo** (migration-56): mora em `memberships.permissions`, com as 5 caixinhas de `src/lib/permissions.ts` (door_code, alarm, preferences, notes, checkin). Chave ausente = liberado (regra 6). `positions`/`position_id` viraram legado — a 56 copia o que valia e ninguém mais lê; apagar é decisão do David (SQL comentado no fim da 56).
- **A migration-54 está vazia de propósito.** As três coisas que ela fazia foram substituídas pela 53 (acesso ilimitado), 55 (papéis) e 56 (permissão por pessoa). O arquivo ficou só para não abrir buraco na numeração — pode pular.
- Nomes antigos: `standard` → Base, `plus` antigo → Pro. O nome `plus` colide, então migration-53 e deploy andam juntos.

### Regras de negócio que já causaram incidentes
1. **`clients.default_price` é a fonte única do preço** (migrations 42-43). Mudou no cadastro → propaga para limpezas não pagas e faturas abertas. Exceção: `price_manual` na limpeza.
2. **Fatura só nasce após o serviço** (migration-44) — trigger no check-out; nunca para `scheduled_at` futuro. Vencimento conta da data da limpeza.
3. **Frequências**: semanal(7) / quinzenal(14) / tres_semanas(21) / mensal(28). Se tocar em uma, tocar em TODAS: telas, actions, tipos, traduções e check constraint do banco.
4. **Tempo estimado nunca aparece para o cliente** — só interno.
5. **Cliente "deletado" = banido** (motivo obrigatório, só `admin`, senha). Não é exclusão.
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
 ('current_company_id','is_manager','is_admin','can_see_values','sees_team',
  'my_permissions','guard_last_admin',
  'has_commercial','has_reports','current_mode',
  'company_max_clients','company_max_users','can_send_sms','sms_unread_count');
```
Faltando alguma → a migration correspondente não rodou.
