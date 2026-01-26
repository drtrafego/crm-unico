// Script para adicionar usuário diretamente no banco de dados
// Execute com: node --experimental-modules scripts/add-user.mjs

import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não encontrada no .env.local');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const NEW_USER_EMAIL = 'locadoradaconstrucao@gmail.com';
const NEW_USER_NAME = 'Locadora da Construção';

async function main() {
  try {
    console.log('🔍 Buscando organização existente...');
    
    // 1. Buscar a organização existente
    const orgs = await sql`SELECT * FROM organizations LIMIT 1`;
    
    if (orgs.length === 0) {
      console.error('❌ Nenhuma organização encontrada no banco de dados');
      process.exit(1);
    }
    
    const org = orgs[0];
    console.log(`✅ Encontrada organização: "${org.name}" (ID: ${org.id})`);
    
    // 2. Verificar se o usuário já existe
    console.log(`\n🔍 Verificando se o usuário ${NEW_USER_EMAIL} já existe...`);
    const existingUsers = await sql`SELECT * FROM "user" WHERE email = ${NEW_USER_EMAIL}`;
    
    let userId;
    
    if (existingUsers.length > 0) {
      userId = existingUsers[0].id;
      console.log(`✅ Usuário já existe com ID: ${userId}`);
    } else {
      // 3. Criar o usuário
      console.log(`\n📝 Criando novo usuário...`);
      const newUser = await sql`
        INSERT INTO "user" (id, name, email, "emailVerified")
        VALUES (gen_random_uuid()::text, ${NEW_USER_NAME}, ${NEW_USER_EMAIL}, NOW())
        RETURNING *
      `;
      userId = newUser[0].id;
      console.log(`✅ Usuário criado com ID: ${userId}`);
    }
    
    // 4. Verificar se já é membro da organização
    console.log(`\n🔍 Verificando se já é membro da organização...`);
    const existingMember = await sql`
      SELECT * FROM members 
      WHERE user_id = ${userId} AND organization_id = ${org.id}
    `;
    
    if (existingMember.length > 0) {
      console.log(`✅ Usuário já é membro da organização com role: ${existingMember[0].role}`);
    } else {
      // 5. Adicionar como membro da organização
      console.log(`\n📝 Adicionando usuário como membro da organização...`);
      await sql`
        INSERT INTO members (user_id, organization_id, role)
        VALUES (${userId}, ${org.id}, 'admin')
      `;
      console.log(`✅ Usuário adicionado como 'admin' na organização "${org.name}"`);
    }
    
    console.log('\n🎉 Processo concluído com sucesso!');
    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log(`   1. O usuário pode acessar: [URL do seu app]`);
    console.log(`   2. Clicar em "Sign in with Google" usando o email: ${NEW_USER_EMAIL}`);
    console.log(`   3. Será direcionado automaticamente para o painel de leads da organização`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
