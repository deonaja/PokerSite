// Generate a VAPID keypair for Web Push, ONCE per deployment.
//
// VAPID = the server's "ID card" so the browser push service (Google/Mozilla/
// Apple) accepts notifications from this app. Run once, paste the output into
// .env.local (and later into Vercel → Project → Environment Variables).
//
//   pnpm gen:vapid
//
// The PUBLIC key is exposed to the browser (NEXT_PUBLIC_…); the PRIVATE key is
// a secret — never commit it, never ship it to the client.
import webpush from 'web-push'

const { publicKey, privateKey } = webpush.generateVAPIDKeys()

console.log(`
VAPID keys generated. Paste these into .env.local:

NEXT_PUBLIC_VAPID_PUBLIC_KEY="${publicKey}"
VAPID_PRIVATE_KEY="${privateKey}"
VAPID_SUBJECT="mailto:deonpwa@gmail.com"

Keep VAPID_PRIVATE_KEY secret. Set the same three in Vercel (Production) before deploy.
`)
