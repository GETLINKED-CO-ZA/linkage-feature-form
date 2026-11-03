export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "office@getlinked.co.za";
  const recipientEmail = process.env.BREVO_RECIPIENT_EMAIL || "linkage@getlinked.co.za";

  if (!apiKey) return res.status(500).json({ error: "Email service is not configured yet." });

  try {
    const { fields = {}, answers = [], files = [], website_hp } = req.body || {};
    if (website_hp) return res.status(200).json({ ok: true });

    const f = {};
    for (const k of ["name", "business", "whatsapp", "email", "website", "social", "location", "format", "story"]) {
      f[k] = clean(fields[k], k === "story" ? 8000 : 500);
    }
    if (!f.name || !f.email || !f.whatsapp || !/^\S+@\S+\.\S+$/.test(f.email)) {
      return res.status(400).json({ error: "Please check your name, email and WhatsApp number." });
    }
    if (!Array.isArray(files) || files.length > 10) {
      return res.status(400).json({ error: "Please upload no more than 10 images." });
    }

    const attachment = [];
    let total = 0;
    for (const file of files) {
      const data = file && file.data;
      if (typeof data !== "string" || !/^[A-Za-z0-9+/=]+$/.test(data)) {
        return res.status(400).json({ error: "One of the images could not be processed." });
      }
      total += data.length;
      attachment.push({ name: clean(file.name, 120).replace(/[^a-zA-Z0-9._-]/g, "_") || "photo.jpg", content: data });
    }
    if (total > 4_400_000) {
      return res.status(413).json({ error: "The images are too large. Please try smaller photos." });
    }

    const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const row = (k, v) => `<tr><td style="padding:6px 12px;color:#7b1c1c;font-weight:bold;vertical-align:top">${esc(k)}</td><td style="padding:6px 12px">${esc(v) || "-"}</td></tr>`;

    const html = `<div style="font-family:Georgia,serif;max-width:720px;color:#111">
      <h2 style="border-bottom:3px solid #d4af37;padding-bottom:8px">New Linkage feature submission</h2>
      <table style="border-collapse:collapse">${[
        ["Owner", f.name], ["Business", f.business], ["WhatsApp", f.whatsapp], ["Email", f.email],
        ["Website", f.website], ["Social links", f.social], ["Location", f.location], ["Format chosen", f.format]
      ].map(([k, v]) => row(k, v)).join("")}</table>
      ${f.story ? `<h3>Own story</h3><p style="white-space:pre-wrap">${esc(f.story)}</p>` : ""}
      <h3>Answers</h3>
      ${(Array.isArray(answers) ? answers : []).slice(0, 10).map((a) =>
        `<p><b>${esc(clean(a.q, 300))}</b><br><span style="white-space:pre-wrap">${esc(clean(a.a, 8000)) || "<i>(skipped)</i>"}</span></p>`).join("")}
      <p style="color:#666">${attachment.length} image(s) attached. Received ${new Date().toISOString()}</p></div>`;

    const email = {
      sender: { name: "The Linkage Magazine: Feature Form", email: senderEmail },
      to: [{ email: recipientEmail, name: "The Linkage Editorial Team" }],
      replyTo: { email: f.email, name: f.name },
      subject: `Feature submission: ${f.business || f.name}`,
      htmlContent: html
    };
    if (attachment.length) email.attachment = attachment;

    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { accept: "application/json", "api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify(email)
    });

    if (!brevoResponse.ok) {
      console.error("Brevo email request failed:", brevoResponse.status, await brevoResponse.text());
      return res.status(502).json({ error: "The email service could not accept your submission. Please try again." });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Submission handler error:", error);
    return res.status(500).json({ error: "Something went wrong while sending your submission." });
  }
}

function clean(value, maxLength) {
  return typeof value === "string"
    ? value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, maxLength)
    : "";
}
