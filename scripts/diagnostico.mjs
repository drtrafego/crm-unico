// Script para diagnóstico completo do usuário
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

const EMAIL = 'locadoradaconstrucao@gmail.com';

async function diagnostico() {
    console.log('='.repeat(60));
    console.log('DIAGNOSTICO COMPLETO');
    console.log('='.repeat(60));

    // 1. Buscar usuário
    console.log('\n1. USUARIO NA TABELA "user":');
    const users = await sql`SELECT * FROM "user" WHERE email = ${EMAIL}`;
    if (users.length > 0) {
        console.log(JSON.stringify(users[0], null, 2));
    } else {
        console.log('   >>> NAO ENCONTRADO! <<<');
    }

    // 2. Buscar todas as contas (OAuth accounts)
    console.log('\n2. CONTAS OAUTH NA TABELA "account":');
    if (users.length > 0) {
        const accounts = await sql`SELECT * FROM account WHERE "userId" = ${users[0].id}`;
        if (accounts.length > 0) {
            console.log(JSON.stringify(accounts, null, 2));
        } else {
            console.log('   >>> NENHUMA CONTA OAUTH VINCULADA! <<<');
            console.log('   (Isso significa que o usuario precisa fazer login com Google pela primeira vez)');
        }
    }

    // 3. Buscar memberships
    console.log('\n3. MEMBROS NA TABELA "members":');
    if (users.length > 0) {
        const members = await sql`
      SELECT m.*, o.name as org_name, o.slug as org_slug
      FROM members m
      LEFT JOIN organizations o ON m.organization_id = o.id
      WHERE m.user_id = ${users[0].id}
    `;
        if (members.length > 0) {
            console.log(JSON.stringify(members, null, 2));
        } else {
            console.log('   >>> NAO E MEMBRO DE NENHUMA ORG! <<<');
        }
    }

    // 4. Listar todas as organizações
    console.log('\n4. TODAS AS ORGANIZACOES:');
    const orgs = await sql`SELECT * FROM organizations`;
    console.log(JSON.stringify(orgs, null, 2));

    // 5. Listar todos os usuários
    console.log('\n5. TODOS OS USUARIOS:');
    const allUsers = await sql`SELECT id, name, email FROM "user"`;
    console.log(JSON.stringify(allUsers, null, 2));

    // 6. Listar todos os membros
    console.log('\n6. TODOS OS MEMBROS:');
    const allMembers = await sql`
    SELECT m.*, u.email as user_email, o.name as org_name
    FROM members m
    LEFT JOIN "user" u ON m.user_id = u.id
    LEFT JOIN organizations o ON m.organization_id = o.id
  `;
    console.log(JSON.stringify(allMembers, null, 2));

    // 7. Sessions ativas
    console.log('\n7. SESSIONS ATIVAS:');
    const sessions = await sql`SELECT * FROM session`;
    console.log(JSON.stringify(sessions, null, 2));

    console.log('\n' + '='.repeat(60));
}

diagnostico().catch(console.error);
