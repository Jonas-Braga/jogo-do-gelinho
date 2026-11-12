// Service worker do app (PWA). Existe só para o Chrome/Edge do Android permitirem
// instalar o jogo na tela inicial. NÃO guarda nada em cache: tudo vem sempre da
// rede, como no site, para o navegador nunca misturar módulos antigos e novos
// depois de uma atualização do jogo (e as contas/ranking precisam de internet).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Só as páginas e arquivos do próprio jogo; o resto (Firebase etc.) segue direto
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req).catch(() => new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">' +
      '<body style="background:#04192a;color:#fff;font:18px system-ui;display:grid;place-items:center;height:100vh;margin:0">' +
      '<p>Sem conexão. O Jogo do Gelinho precisa de internet para jogar.</p></body>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )),
  );
});
