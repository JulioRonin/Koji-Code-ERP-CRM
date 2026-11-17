-- ============================================================================
-- KANRI · Mensajes directos privados en el chat
-- Idempotente. Ejecutar en Supabase → SQL Editor.
--
-- Un mensaje directo es un canal con category = 'DIRECTO' y member_ids con
-- los dos participantes. Las políticas RESTRICTIVAS hacen que:
--   * solo sus miembros vean el canal directo, y
--   * solo se lean/escriban mensajes de canales que el usuario puede ver.
-- Los canales normales (general, producción…) no cambian.
-- ============================================================================

ALTER TABLE public.chat_channels
    ADD COLUMN IF NOT EXISTS member_ids UUID[];

CREATE INDEX IF NOT EXISTS idx_chat_channels_members ON public.chat_channels USING GIN (member_ids);

ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dm members only" ON public.chat_channels;
CREATE POLICY "dm members only" ON public.chat_channels
    AS RESTRICTIVE FOR ALL TO authenticated
    USING (category IS DISTINCT FROM 'DIRECTO' OR auth.uid() = ANY (member_ids))
    WITH CHECK (category IS DISTINCT FROM 'DIRECTO' OR auth.uid() = ANY (member_ids));

-- El mensaje es visible solo si su canal es visible (la política de arriba
-- oculta los directos ajenos, así que sus mensajes también quedan ocultos).
DROP POLICY IF EXISTS "messages of visible channels" ON public.chat_messages;
CREATE POLICY "messages of visible channels" ON public.chat_messages
    AS RESTRICTIVE FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.id = chat_messages.channel_id))
    WITH CHECK (EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.id = chat_messages.channel_id));

NOTIFY pgrst, 'reload schema';
-- ============================================================================
