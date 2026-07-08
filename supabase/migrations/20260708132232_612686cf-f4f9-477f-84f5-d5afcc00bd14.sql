
-- Prevent duplicate proposals from the same provider on the same request
ALTER TABLE public.propostas
  ADD CONSTRAINT propostas_solicitacao_prestador_unique UNIQUE (solicitacao_id, prestador_id);

-- Block proposals against non-open requests at DB level
CREATE OR REPLACE FUNCTION public.check_solicitacao_aberta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _status public.status_solicitacao;
BEGIN
  SELECT status INTO _status FROM public.solicitacoes WHERE id = NEW.solicitacao_id;
  IF _status NOT IN ('aberto', 'recebendo_propostas') THEN
    RAISE EXCEPTION 'Esta solicitação não está mais aberta para propostas.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_solicitacao_aberta ON public.propostas;
CREATE TRIGGER trg_check_solicitacao_aberta
  BEFORE INSERT ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.check_solicitacao_aberta();

NOTIFY pgrst, 'reload schema';
