// ============================================================================
// AGS Telecom - Cancelamento Express
// BATCH USER INGESTION SCRIPT (Official Supabase API Method)
// Author: Senior DBA / Fullstack Developer
// ============================================================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "❌ Erro: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configurados no seu arquivo .env!",
  );
  console.error(
    "Por favor, verifique se você já adicionou a chave secreta service_role no seu .env.",
  );
  process.exit(1);
}

// Initialize Supabase Admin Client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const DEFAULT_PASSWORD = "Agstelecom@2026";

// Dataset of 30 users to provision
const users = [
  {
    name: "Alexsandra Goncalves Cardoso",
    email: "alexsandra.goncalves.cardoso@agstelecom.com.br",
    role: "consultor",
  },
  { name: "Amanda Dornelas", email: "amanda.dornelas@agstelecom.com.br", role: "consultor" },
  { name: "Amanda Santos", email: "amanda.santos@agstelecom.com.br", role: "consultor" },
  { name: "Ana Clara", email: "ana.clara@agstelecom.com.br", role: "consultor" },
  { name: "Assuerio Rocha", email: "assuerio.rocha@agstelecom.com.br", role: "consultor" },
  { name: "Bruno", email: "bruno@agstelecom.com.br", role: "consultor" },
  { name: "Carlos Augusto", email: "carlos.augusto@agstelecom.com.br", role: "consultor" },
  {
    name: "Crisleny Maria Claudino dos Santos",
    email: "crisleny.maria.claudino.dos.santos@agstelecom.com.br",
    role: "consultor",
  },
  { name: "Danielly", email: "danielly@agstelecom.com.br", role: "consultor" },
  {
    name: "Gleybson Silva Caldas",
    email: "gleybson.silva.caldas@agstelecom.com.br",
    role: "consultor",
  },
  {
    name: "Guilherme Fernando C. dos Santos",
    email: "guilherme.fernando.c.dos.santos@agstelecom.com.br",
    role: "consultor",
  },
  { name: "Halerrandro", email: "halerrandro@agstelecom.com.br", role: "consultor" },
  { name: "Jamily", email: "jamily@agstelecom.com.br", role: "consultor" },
  { name: "Jenyffer", email: "jenyffer@agstelecom.com.br", role: "consultor" },
  { name: "Joao Gonzaga", email: "joao.gonzaga@agstelecom.com.br", role: "consultor" },
  { name: "Joao Lucas", email: "joao.lucas@agstelecom.com.br", role: "consultor" },
  { name: "Josimar Soares Jr", email: "josimar.soares.jr@agstelecom.com.br", role: "consultor" },
  { name: "Juliana Cabral", email: "juliana.cabral@agstelecom.com.br", role: "consultor" },
  { name: "Kamila Emanuele", email: "kamila.emanuele@agstelecom.com.br", role: "consultor" },
  { name: "Kauane", email: "kauane@agstelecom.com.br", role: "consultor" },
  {
    name: "Luciene Soares Batista",
    email: "luciene.soares.batista@agstelecom.com.br",
    role: "consultor",
  },
  { name: "Maria Nicolly", email: "maria.nicolly@agstelecom.com.br", role: "consultor" },
  { name: "Mika Maria", email: "mika.maria@agstelecom.com.br", role: "consultor" },
  { name: "Mycaelly Jeronimo", email: "mycaelly.jeronimo@agstelecom.com.br", role: "consultor" },
  {
    name: "Pedro Henrique Silva",
    email: "pedro.henrique.silva@agstelecom.com.br",
    role: "consultor",
  },
  {
    name: "Raynne Carolayne da Silva",
    email: "raynne.carolayne.da.silva@agstelecom.com.br",
    role: "consultor",
  },
  { name: "Ruann", email: "ruann@agstelecom.com.br", role: "consultor" },
  { name: "Savio Rafael", email: "savio.rafael@agstelecom.com.br", role: "consultor" },
  { name: "Taciana Supervisao", email: "taciana.supervisao@agstelecom.com.br", role: "supervisor" },
  { name: "Thiago Lucio", email: "thiago.lucio@agstelecom.com.br", role: "consultor" },
];

async function seed() {
  console.log("🚀 Iniciando o provisionamento de usuários no Supabase...");
  let createdCount = 0;
  let skippedCount = 0;

  for (const user of users) {
    try {
      // 1. Check if user already exists in auth
      const { data: existing, error: checkErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();

      let userId;

      if (existing) {
        userId = existing.id;
        console.log(`⚠️  [JÁ EXISTE] ${user.email} (pulando criação no Auth)`);
        skippedCount++;
      } else {
        // 2. Create the user using Supabase Admin Auth API
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
          email: user.email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: {
            display_name: user.name,
            must_change_credentials: true,
          },
        });

        if (createErr) {
          console.error(`❌  [ERRO AO CRIAR] ${user.email}: ${createErr.message}`);
          continue;
        }

        userId = created.user.id;
        console.log(`✅  [CRIADO] ${user.email}`);
        createdCount++;
      }

      // 3. Guarantee user has their correct role in public.user_roles
      const { error: roleErr } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: user.role }, { onConflict: "user_id,role" });

      if (roleErr) {
        console.error(
          `❌  [ERRO ROLE] Falha ao associar papel de ${user.role} a ${user.email}: ${roleErr.message}`,
        );
      }
    } catch (e) {
      console.error(`❌  [ERRO CRÍTICO] Falha inesperada ao processar ${user.email}:`, e);
    }
  }

  // 4. Safe Provisioning for Douglas Antonny (Assign admin access)
  try {
    const { data: douglas, error: douglasErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", "douglasantonny@hotmail.com")
      .maybeSingle();

    if (douglas) {
      const { error: douglasRoleErr } = await supabase
        .from("user_roles")
        .upsert({ user_id: douglas.id, role: "admin" }, { onConflict: "user_id,role" });

      if (douglasRoleErr) {
        console.error(`❌  [ERRO ADMIN DOUGLAS]: ${douglasRoleErr.message}`);
      } else {
        console.log("⭐  [ADMIN] Douglas Antonny garantido com acesso administrativo (admin).");
      }
    } else {
      console.log(
        "ℹ️  [INFO] Douglas Antonny não encontrado nos perfis. Lembre-se de criar o cadastro dele antes.",
      );
    }
  } catch (e) {
    console.error("❌  [ERRO ADMIN DOUGLAS] Falha ao provisionar admin Douglas:", e);
  }

  console.log("\n============================================================");
  console.log(`🎉 Ingestão Concluída!`);
  console.log(`- Criados novos no Auth: ${createdCount}`);
  console.log(`- Perfis já existentes: ${skippedCount}`);
  console.log("============================================================");
}

seed();
