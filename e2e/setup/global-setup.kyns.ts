import { request } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function globalSetup() {
  const baseURL = 'https://chat.kyns.ai';
  const email = process.env.KYNS_TEST_EMAIL;
  const password = process.env.KYNS_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error('KYNS_TEST_EMAIL e KYNS_TEST_PASSWORD devem estar definidos em e2e/.env.e2e');
  }

  console.log('🤖: Validando credenciais em', baseURL);

  const ctx = await request.newContext({ baseURL });
  const resp = await ctx.post('/api/auth/login', { data: { email, password } });
  if (!resp.ok()) throw new Error(`Login falhou: ${resp.status()}`);

  const data = (await resp.json()) as { token: string; user: object };
  if (!data.token) throw new Error('Resposta de login sem token');

  const tokenFile = path.resolve(process.cwd(), 'e2e/.kyns-session.json');
  fs.writeFileSync(tokenFile, JSON.stringify({ token: data.token, user: data.user, ts: Date.now() }));

  const storageStateFile = path.resolve(process.cwd(), 'e2e/storageState.kyns.json');
  fs.writeFileSync(storageStateFile, JSON.stringify({ cookies: [], origins: [] }));

  await ctx.dispose();
  console.log('🤖: ✅ Setup concluído, token armazenado');
}

export default globalSetup;
