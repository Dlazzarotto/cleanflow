-- =============================================================
-- CleanFlow AI - Migracao 52: ingles como idioma base
-- Executar no SQL Editor do Supabase.
--
-- O produto atende donos de empresa de limpeza nos EUA que falam
-- ingles, portugues, espanhol e frances. O ingles passa a ser a
-- lingua principal; as outras continuam disponiveis como escolha.
--
-- Ate aqui o padrao de toda coluna de idioma era 'pt', entao um
-- cliente cadastrado sem ninguem tocar no campo recebia documento,
-- SMS e e-mail em portugues. Esta migracao troca apenas o DEFAULT
-- (vale para linhas novas). Os check constraints seguem aceitando
-- os quatro idiomas - nada e removido.
--
-- Pre-requisito: migration-51 (commercial_estimates). Se a 51 ainda
-- nao rodou, o bloco correspondente e ignorado com seguranca.
-- =============================================================

-- Idioma da cliente final: documentos, faturas, SMS e e-mail.
alter table public.clients
  alter column language set default 'en';

alter table public.estimates
  alter column language set default 'en';

-- Idioma da interface do usuario da empresa (gestora/dono).
alter table public.user_settings
  alter column locale set default 'en';

-- Orcamentos comerciais (criados na migration-51).
do $$
begin
  if to_regclass('public.commercial_estimates') is not null then
    alter table public.commercial_estimates
      alter column language set default 'en';
  end if;
end $$;

-- =============================================================
-- OPCIONAL - retroativo. Nao roda junto com o bloco acima.
--
-- O trecho abaixo troca para ingles as linhas que estao em 'pt'
-- APENAS porque o padrao antigo era esse. Ele nao tem como
-- distinguir isso de uma escolha deliberada de portugues, entao
-- rode so depois de conferir na tela de clientes quem realmente
-- precisa receber em portugues.
--
-- Para conferir antes, quantas linhas seriam afetadas:
--
--   select count(*) from public.clients   where language = 'pt';
--   select count(*) from public.estimates where language = 'pt';
--
-- Para aplicar, remova o comentario das linhas abaixo:
--
-- update public.clients        set language = 'en' where language = 'pt';
-- update public.estimates      set language = 'en' where language = 'pt';
-- update public.user_settings  set locale   = 'en' where locale   = 'pt';
-- =============================================================
