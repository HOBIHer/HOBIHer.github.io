export interface SupabaseEnv {
  url: string
  publishableKey: string
}

export function readSupabaseEnv(): SupabaseEnv | null {
  const url = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) return null
  return { url, publishableKey }
}
