// Vercel serverless function: emails the submission (with photos) to Linkage via Resend.
// Env vars (Vercel > Settings > Environment Variables): RESEND_API_KEY, FROM_EMAIL (e.g. "Linkage <forms@getlinked.co.za>")
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { fields = {}, answers = [], files = [], website_hp } = req.body || {};
    if (website_hp) return res.status(200).json({ ok: true }); // honeypot
    if (!fields.name || !fields.email || !fields.whatsapp) return res.status(400).json({ error: 'Missing contact details' });
    if (files.length > 10) return res.status(400).json({ error: 'Too many photos' });

    const row = (k, v) => `<tr><td style="padding:6px 12px;color:#7b1c1c;font-weight:bold;vertical-align:top">${esc(k)}</td><td style="padding:6px 12px">${esc(v)}</td></tr>`;
    const html = `<div style="font-family:Georgia,serif;max-width:720px;color:#111">
      <h2 style="border-bottom:3px solid #d4af37;padding-bottom:8px">New Linkage feature submission</h2>
      <table style="border-collapse:collapse">${[
        ['Owner', fields.name], ['Business', fields.business], ['WhatsApp', fields.whatsapp], ['Email', fields.email],
        ['Website', fields.website], ['Social links', fields.social], ['Location', fields.location], ['Format chosen', fields.format]
      ].map(([k, v]) => row(k, v)).join('')}</table>
      ${fields.story ? `<h3>Own story</h3><p style="white-space:pre-wrap">${esc(fields.story)}</p>` : ''}
      <h3>Answers</h3>
      ${answers.map(a => `<p><b>${esc(a.q)}</b><br><span style="white-space:pre-wrap">${esc(a.a) || '<i>(skipped)</i>'}</span></p>`).join('')}
      <p style="color:#666">${files.length} photo(s) attached.</p></div>`;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL,
        to: ['linkage@getlinked.co.za'],
        reply_to: fields.email,
        subject: `Feature submission: ${fields.business || fields.name}`,
        html,
        attachments: files.map(f => ({ filename: String(f.name).replace(/[^\w.\-]/g, '_'), content: f.data }))
      })
    });
    if (!r.ok) return res.status(502).json({ error: 'Email service error', detail: await r.text() });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
}
