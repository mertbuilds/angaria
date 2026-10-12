import { messages } from './messages.ts';

// HTML the portal sends instead of JSON: its maintenance page, a proxy's 5xx
// page, and the emulator's own index.

export const maintenanceHTML = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>e-Arşiv Portal</title>
<style>body{font-family:Arial,Helvetica,sans-serif;background:#f4f4f4;color:#333;text-align:center;padding-top:80px}.box{display:inline-block;background:#fff;border:1px solid #ccc;padding:32px 48px}</style>
</head>
<body>
<div class="box">
<h2>e-Arşiv Portal</h2>
<p>${messages.maintenance}</p>
<p>Gelir İdaresi Başkanlığı</p>
</div>
</body>
</html>
`;

const STATUS_TEXT: Record<number, string> = {
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export const serverErrorHTML = (status: number) => {
  const title = `${status} ${STATUS_TEXT[status] ?? 'Error'}`;
  return `<html>
<head><title>${title}</title></head>
<body>
<center><h1>${title}</h1></center>
<hr><center>nginx</center>
</body>
</html>
`;
};

export const notFoundHTML = `<html>
<head><title>404 Not Found</title></head>
<body>
<center><h1>404 Not Found</h1></center>
<hr><center>nginx</center>
</body>
</html>
`;

const escapeHTML = (value: string) =>
  value.replaceAll(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

export const indexHTML = (users: Array<{ password: string; userid: string }>) => `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><title>GİB e-Arşiv emülatörü</title></head>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 16px">
<h1 style="font-weight:500">GİB e-Arşiv emülatörü</h1>
<p>Local stand-in for earsivportal.efatura.gov.tr and www.tcmb.gov.tr/kurlar.</p>
<p>Users: ${users.map(({ password, userid }) => `<code>${escapeHTML(userid)}</code> / <code>${escapeHTML(password)}</code>`).join(', ')}</p>
<p>State: <a href="/__emulator/state">/__emulator/state</a>. Today's rates: <a href="/kurlar/today.xml">/kurlar/today.xml</a>.</p>
</body>
</html>
`;
