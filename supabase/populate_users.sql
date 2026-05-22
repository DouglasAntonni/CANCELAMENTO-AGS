-- ============================================================================
-- AGS Telecom - Cancelamento Express
-- BATCH USER INGESTION & CREDENTIAL PROVISIONING SCRIPT
-- Author: Senior DBA / Fullstack Developer
-- Target Platform: Supabase (PostgreSQL)
-- ============================================================================

-- INSTRUCTIONS:
-- 1. Open the Supabase SQL Editor.
-- 2. Paste the entire content of this file and click "Run".
-- 3. All 30 users will be created in auth.users and public.profiles instantly.
-- 4. They will be confirmed immediately (no confirmation email required).

BEGIN;

-- 1. Generate the bcrypt hash exactly ONCE for high-performance execution (saves CPU time)
WITH pwd_hash AS (
  SELECT extensions.crypt('Agstelecom@2026', extensions.gen_salt('bf', 10)) AS hash
),

-- 2. Define the dataset of users to be created
user_data (id, display_name, email, default_role) AS (
  VALUES
    (gen_random_uuid(), 'Alexsandra Goncalves Cardoso', 'alexsandra.goncalves.cardoso@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Amanda Dornelas', 'amanda.dornelas@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Amanda Santos', 'amanda.santos@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Ana Clara', 'ana.clara@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Assuerio Rocha', 'assuerio.rocha@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Bruno', 'bruno@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Carlos Augusto', 'carlos.augusto@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Crisleny Maria Claudino dos Santos', 'crisleny.maria.claudino.dos.santos@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Danielly', 'danielly@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Gleybson Silva Caldas', 'gleybson.silva.caldas@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Guilherme Fernando C. dos Santos', 'guilherme.fernando.c.dos.santos@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Halerrandro', 'halerrandro@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Jamily', 'jamily@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Jenyffer', 'jenyffer@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Joao Gonzaga', 'joao.gonzaga@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Joao Lucas', 'joao.lucas@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Josimar Soares Jr', 'josimar.soares.jr@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Juliana Cabral', 'juliana.cabral@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Kamila Emanuele', 'kamila.emanuele@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Kauane', 'kauane@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Luciene Soares Batista', 'luciene.soares.batista@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Maria Nicolly', 'maria.nicolly@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Mika Maria', 'mika.maria@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Mycaelly Jeronimo', 'mycaelly.jeronimo@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Pedro Henrique Silva', 'pedro.henrique.silva@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Raynne Carolayne da Silva', 'raynne.carolayne.da.silva@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Ruann', 'ruann@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Savio Rafael', 'savio.rafael@agstelecom.com.br', 'consultor'::public.app_role),
    (gen_random_uuid(), 'Taciana Supervisao', 'taciana.supervisao@agstelecom.com.br', 'supervisor'::public.app_role),
    (gen_random_uuid(), 'Thiago Lucio', 'thiago.lucio@agstelecom.com.br', 'consultor'::public.app_role)
),

-- 3. Insert users into auth.users (Supabase Auth Core)
inserted_users AS (
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user
  )
  SELECT 
    '00000000-0000-0000-0000-000000000000'::uuid, -- Default Supabase instance ID
    u.id,
    'authenticated',
    'authenticated',
    u.email,
    p.hash,
    now(), -- Mark as confirmed immediately to avoid registration emails
    jsonb_build_object('provider', 'email', 'providers', array_to_json(array['email'])::jsonb),
    jsonb_build_object('display_name', u.display_name, 'must_change_credentials', true),
    now(),
    now(),
    false
  FROM user_data u
  CROSS JOIN pwd_hash p
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.email = u.email
  )
  RETURNING id, email
)

-- 4. Map and insert default user roles into public.user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT 
  iu.id,
  u.default_role
FROM inserted_users iu
JOIN user_data u ON u.email = iu.email
ON CONFLICT (user_id, role) DO NOTHING;

-- 5. Safe Provisioning for Douglas Antonny (Assign admin access if he already exists)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'douglasantonny@hotmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

COMMIT;
