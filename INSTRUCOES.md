# CleanFlow — Snapshot completo

Versão final e auditada. Substitui qualquer pacote anterior.

## Aplicar
1. Extrair por cima da pasta do projeto, substituindo tudo
2. `Test-Path "src\lib\actions\invoices.ts"` deve dar True
3. `git add .` → `git commit -m "Snapshot"` → `git push`

## Migrações (pasta supabase/) — rodar na ordem, as que faltarem
schema · 2 rotas/calendário · 3 estimates · 4 contrato · 5 lead · 6 mercado ·
7 memberships · 8 equipe sem valores · 9 GPS/mapa · 10 auditoria · 11 cargos ·
12 idiomas · 13 configurações · 14 sede · 15 status cliente · 16 banimento ·
17 funil · 18 ex-clientes · 19 marketing · 20 escopo marketing · 21 plataforma ·
22 planos · 23 origem · 24 ocorrências · 25 GPS ocorrência · 26 fluxo de campo ·
27 jornada · 28 cobrança/contrato · 29 faturas · 30 extras · 31 deep clean ·
32 extras sem valor

## Variáveis (Vercel)
NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_ANON_KEY ·
SUPABASE_SERVICE_ROLE_KEY · ANTHROPIC_API_KEY ·
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY · RESEND_API_KEY · EMAIL_FROM (opcional)

## Regras de negócio travadas no banco
- Equipe nunca vê valores, pagamentos ou preços de extras
- "Sem acesso" exige check-in, tentativas de contato e aprovação da gestão
- Check-in/check-out só a até 100 m da casa, com jornada iniciada
- Relato de ocorrência é imutável (auditoria)
- Banimento de cliente exige motivo e senha do dono
- Marketing vê apenas os leads que cadastrou
- Limite de equipes conforme o plano contratado
