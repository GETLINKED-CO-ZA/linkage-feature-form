# Linkage feature form – setup
Files: `index.html`, `linkage-logo.png`, `api/submit.js` (keep this folder structure).

1. Push the folder to GitHub, import the repo in Vercel (no build settings needed).
2. Create a free Resend account, verify getlinked.co.za, create an API key.
3. In Vercel > Settings > Environment Variables add:
   - `RESEND_API_KEY` = your key
   - `FROM_EMAIL` = `Linkage <forms@getlinked.co.za>`
4. Redeploy. Submissions arrive at linkage@getlinked.co.za with photos attached; Reply goes to the founder.

Note: Vercel limits request bodies to 4.5 MB, so the page automatically compresses photos before sending.
