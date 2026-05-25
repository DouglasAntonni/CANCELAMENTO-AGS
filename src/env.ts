import { z } from "zod";

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url("A URL do Supabase é inválida"),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, "A chave publicável do Supabase é obrigatória"),
  // Você pode adicionar outras variáveis expostas aqui
});

// Apenas validação no lado cliente de variáveis VITE_*
export const env = envSchema.parse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});
