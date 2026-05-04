import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push'

const VAPID_PUBLIC_KEY = 'BFtg423bs2IH-MAqzS42AAndmvqqkJL31kgPSP2-yqQdkLCmgzhwN0NgpaKXwnoTTiLXVqySXJ3W13Fpc461MiI'
const VAPID_PRIVATE_KEY = 'ejivXIub0bEAiG9STzbjAhtCGqcqqQe7VOs07iiL46A'

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

serve(async (req) => {
  const { user_id, title, message } = await req.json()

  // Initialize Supabase Client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Get subscriptions for this user
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', user_id)

  if (error || !subs) {
    return new Response(JSON.stringify({ error: 'No subscriptions found' }), { status: 404 })
  }

  const results = await Promise.all(subs.map(s => 
    webpush.sendNotification(s.subscription, JSON.stringify({
      title: title,
      body: message
    })).catch(err => {
      console.error('Push failed for sub:', err)
      return null
    })
  ))

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { "Content-Type": "application/json" },
  })
})
