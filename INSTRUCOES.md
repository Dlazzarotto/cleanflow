# CleanFlow — Snapshot completo (31/07/2026)

Versão final e auditada de todo o projeto. Substitui qualquer pacote anterior.

## Como aplicar

1. Extrair este ZIP **por cima** da pasta do projeto, substituindo tudo
2. Verificar: `Test-Path "src\components\DayControl.tsx"` deve dar True
3. `git add .` → `git commit -m "Snapshot completo"` → `git push`

## Migrações do banco (pasta supabase/)

Rodar no SQL Editor do Supabase, **na ordem numérica**, as que ainda não foram aplicadas.
Todas são seguras de repetir.

- schema.sql .................. estrutura inicial
- migration-2 ................. rotas e calendário (series recorrentes)
- migration-3 ................. estimates e configuração de preços
- migration-4 ................. documento e contrato
- migration-5 ................. lead no estimate
- migration-6 ................. cache de mercado
- migration-7 ................. vínculos multiempresa (memberships)
- migration-8 ................. equipe sem acesso a valores
- migration-9 ................. GPS, unidade/apto e mapa
- migration-10 ................ fechamento de auditoria
- migration-11 ................ cargos com permissões
- migration-12 ................ idiomas dos documentos
- migration-13 ................ configurações do usuário
- migration-14 ................ coordenadas da sede
- migration-15 ................ status de clientes
- migration-16 ................ banimento com motivo
- migration-17 ................ funil (visita, lead, recorrência)
- migration-18 ................ ex-clientes x não fecharam
- migration-19 ................ papel de marketing
- migration-20 ................ marketing vê só o que cadastrou
- migration-21 ................ camada da plataforma (admin CleanFlow)
- migration-22 ................ planos Standard/Plus
- migration-23 ................ origem de entrada do cliente
- migration-24 ................ ocorrências com fotos
- migration-25 ................ GPS na ocorrência e sem acesso
- migration-26 ................ fluxo de campo (aprovação, 100 m, auto-encerramento)
- migration-27 ................ jornada do dia

## Variáveis de ambiente (Vercel)

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY .......... convites e criação de empresas
- ANTHROPIC_API_KEY .................. bot e pesquisa de mercado
- NEXT_PUBLIC_GOOGLE_MAPS_API_KEY .... busca de endereços
- RESEND_API_KEY ..................... envio de emails
- EMAIL_FROM (opcional) .............. remetente com domínio verificado
