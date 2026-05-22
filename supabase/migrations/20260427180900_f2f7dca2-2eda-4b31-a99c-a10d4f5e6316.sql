
CREATE TABLE public.cancelamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  operadora TEXT,
  supervisor TEXT,
  nome_cliente TEXT NOT NULL,
  cpf TEXT,
  cnpj TEXT,
  email TEXT,
  nome_mae TEXT,
  data_nascimento DATE,
  endereco_completo TEXT,
  ponto_referencia TEXT,
  contato_1 TEXT,
  contato_2 TEXT,
  fixo TEXT,
  forma_pagamento TEXT,
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  queima TEXT,
  numero_contrato TEXT,
  cancelar_com_multa BOOLEAN DEFAULT false,
  valor_maximo_multa NUMERIC,
  fatura_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cancelamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert cancelamentos"
ON public.cancelamentos FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view cancelamentos"
ON public.cancelamentos FOR SELECT
USING (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('faturas', 'faturas', true);

CREATE POLICY "Anyone can upload faturas"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'faturas');

CREATE POLICY "Anyone can view faturas"
ON storage.objects FOR SELECT
USING (bucket_id = 'faturas');
