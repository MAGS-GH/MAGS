// Ephemeral OIDC/PKCE issuer for localhost integration and browser tests only.
import { createServer } from 'node:http';
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const port = Number(process.env.SALON_TEST_ISSUER_PORT || 54930);
const issuer = 'http://127.0.0.1:' + port;
const roles = {
  admin: '11111111-1111-4111-a111-111111111111',
  owner: '22222222-2222-4222-a222-222222222222',
  reception: '33333333-3333-4333-a333-333333333333',
  staff: '44444444-4444-4444-a444-444444444444',
  other: '55555555-5555-4555-a555-555555555555',
};
const key = { ...publicKey.export({ format: 'jwk' }), kid: randomUUID(), use: 'sig', alg: 'RS256' };
const codes = new Map();

function token(sub, overrides = {}) {
  const seconds = Math.floor(Date.now() / 1000);
  const encode = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const data = encode({ kid: key.kid, alg: 'RS256', typ: 'JWT' }) + '.' + encode({
    iss: issuer, aud: 'mercantec-apps', sub, iat: seconds, exp: seconds + 3600, ...overrides,
  });
  return data + '.' + sign('sha256', Buffer.from(data), privateKey).toString('base64url');
}

const isLoopback = (url) => ['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol === 'http:';
const server = createServer(async (request, response) => {
  const url = new URL(request.url, issuer);
  const json = (code, body) => {
    response.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(body));
  };
  if (request.headers.host !== new URL(issuer).host) return json(403,{});
  if (request.headers.origin) {
    if (!isLoopback(new URL(request.headers.origin))) return json(403,{});
    response.setHeader('access-control-allow-origin', request.headers.origin);
  }
  if (url.pathname === '/.well-known/openid-configuration') return json(200, {
    issuer, jwks_uri: issuer + '/keys', authorization_endpoint: issuer + '/oauth/authorize', token_endpoint: issuer + '/oauth/token',
  });
  if (url.pathname === '/keys') return json(200, { keys: [key] });
  if (url.pathname === '/test-token' && request.method === 'POST') {
    const sub = roles[url.searchParams.get('role')];
    if (!sub) return json(400,{});
    const invalid = url.searchParams.get('invalid');
    return json(200,{ access_token: token(sub, invalid === 'audience' ? { aud: 'other' } : invalid === 'expired' ? { exp: 1 } : {}) });
  }
  if (url.pathname === '/oauth/authorize' && request.method === 'GET') {
    const target = new URL(url.searchParams.get('redirect_uri'));
    if (!isLoopback(target) || target.pathname !== '/auth/callback' || url.searchParams.get('code_challenge_method') !== 'S256')
      return json(400,{error:'local callback/PKCE required'});
    const user = url.searchParams.get('test_role');
    if (!user) {
      response.writeHead(200,{ 'content-type':'text/html; charset=utf-8','cache-control':'no-store' });
      response.end('<h1>Lokal testbruger</h1>' + Object.keys(roles).map(role => {
        const link = new URL(url); link.searchParams.set('test_role', role);
        return '<p><a href="' + link.pathname + link.search.replaceAll('&','&amp;') + '">' + role + '</a></p>';
      }).join(''));
      return;
    }
    if (!roles[user]) return json(400,{});
    const code = randomBytes(32).toString('base64url');
    codes.set(code,{sub:roles[user],uri:target.href, challenge:url.searchParams.get('code_challenge'),client:url.searchParams.get('client_id'),expires:Date.now()+60000});
    target.searchParams.set('code',code);
    target.searchParams.set('state',url.searchParams.get('state'));
    response.writeHead(302,{ location: target.href }); response.end(); return;
  }
  if (url.pathname === '/oauth/token' && request.method === 'POST') {
    let body = '';
    for await (const part of request) { body += part; if(body.length>16000) return json(413,{}); }
    const fields = new URLSearchParams(body);
    const grant = codes.get(fields.get('code'));
    codes.delete(fields.get('code'));
    if (!grant || grant.expires<Date.now() || fields.get('grant_type') !== 'authorization_code' ||
        grant.uri !== fields.get('redirect_uri') || grant.client !== fields.get('client_id') ||
        grant.challenge !== createHash('sha256').update(fields.get('code_verifier') || '').digest('base64url'))
      return json(400,{error:'invalid_grant'});
    return json(200,{access_token:token(grant.sub),token_type:'Bearer',expires_in:3600});
  }
  json(404,{});
});
server.listen(port, '127.0.0.1', () => console.log('Lokal testudsteder på ' + issuer));
