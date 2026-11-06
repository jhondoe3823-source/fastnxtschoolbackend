/**
 * HTML email templates — platform (FastNxt) or school-branded.
 */

const env = require('../../config/env');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {{
 *   brand?: 'platform' | 'school',
 *   logoUrl?: string | null,
 *   brandName?: string,
 *   preheader?: string,
 *   title: string,
 *   bodyHtml: string,
 *   cta?: { label: string, href: string } | null,
 *   footerNote?: string,
 * }} opts
 */
function layout(opts) {
  const isSchool = opts.brand === 'school';
  const logoUrl = opts.logoUrl || (isSchool ? null : env.brand.logoUrl);
  const brandName = opts.brandName || (isSchool ? 'School' : env.brand.name);
  const product = env.brand.productName;
  const accent = isSchool ? '#0f766e' : '#1d4ed8';
  const website = env.brand.website;
  const support = env.brand.supportEmail;

  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(brandName)}" width="140" style="display:block;max-width:140px;height:auto;border:0;" />`
    : `<div style="font-size:22px;font-weight:800;color:${accent};letter-spacing:-0.02em;">${escapeHtml(brandName)}</div>`;

  const cta = opts.cta
    ? `<p style="margin:28px 0 8px;">
         <a href="${escapeHtml(opts.cta.href)}"
            style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:8px;">
           ${escapeHtml(opts.cta.label)}
         </a>
       </p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  ${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>` : ''}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:28px 32px 16px;border-bottom:1px solid #eef2f7;">
              ${logoBlock}
              <p style="margin:10px 0 0;font-size:12px;color:#6b7280;">${escapeHtml(isSchool ? brandName : product)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#0f172a;">${escapeHtml(opts.title)}</h1>
              <div style="font-size:15px;line-height:1.65;color:#334155;">${opts.bodyHtml}</div>
              ${cta}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #eef2f7;">
              <p style="margin:0;font-size:12px;line-height:1.55;color:#94a3b8;">
                ${escapeHtml(opts.footerNote || `You're receiving this email from ${product}.`)}
                ${website ? `<br /><a href="${escapeHtml(website)}" style="color:${accent};text-decoration:none;">${escapeHtml(website.replace(/^https?:\/\//, ''))}</a>` : ''}
                ${support ? `${website ? ' · ' : '<br />'}<a href="mailto:${escapeHtml(support)}" style="color:${accent};text-decoration:none;">${escapeHtml(support)}</a>` : ''}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function welcomePlatform({ name, schoolName, trialDays }) {
  const appUrl = env.brand.appUrl;
  const title = `Welcome to ${env.brand.productName}`;
  const bodyHtml = `
    <p style="margin:0 0 12px;">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 12px;">
      Your school <strong>${escapeHtml(schoolName)}</strong> is registered on
      <strong>${escapeHtml(env.brand.productName)}</strong> by ${escapeHtml(env.brand.name)}.
    </p>
    <p style="margin:0 0 12px;">
      Your free trial has started${trialDays ? ` for <strong>${escapeHtml(String(trialDays))} day(s)</strong>` : ''}.
      Sign in to set up classes, students, fees and more.
    </p>
  `;
  return {
    subject: `${title} — ${schoolName}`,
    html: layout({
      brand: 'platform',
      logoUrl: env.brand.logoUrl,
      brandName: env.brand.name,
      preheader: `Your school ${schoolName} is ready on ${env.brand.productName}.`,
      title,
      bodyHtml,
      cta: { label: 'Open dashboard', href: `${appUrl}/dashboard` },
      footerNote: `This welcome email was sent by ${env.brand.name}.`,
    }),
    text: `Hi ${name},\n\nYour school "${schoolName}" is registered on ${env.brand.productName}. Your free trial has started. Open ${appUrl}/dashboard to get started.\n\n— ${env.brand.name}`,
  };
}

/**
 * School-branded generic notice (uses school logo when available).
 */
function schoolNotice({ schoolName, schoolLogoUrl, title, messageHtml, cta }) {
  return {
    subject: title,
    html: layout({
      brand: 'school',
      logoUrl: schoolLogoUrl || null,
      brandName: schoolName,
      preheader: title,
      title,
      bodyHtml: messageHtml,
      cta: cta || null,
      footerNote: `Sent on behalf of ${schoolName} via ${env.brand.productName}.`,
    }),
    text: `${title}\n\n${String(messageHtml).replace(/<[^>]+>/g, '')}\n\n— ${schoolName}`,
  };
}

module.exports = {
  layout,
  welcomePlatform,
  schoolNotice,
  escapeHtml,
};
