// Script para verificar se o usuário foi adicionado
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

const EMAIL = 'locadoradaconstrucao@gmail.com';

async function verify() {
    console.log('VERIFICACAO DO USUARIO');
    console.log('='.repeat(50));

    // Verificar usuário
    const users = await sql`SELECT id, name, email FROM "user" WHERE email = ${EMAIL}`;
    console.log('\n1. Usuario no banco:');
    if (users.length > 0) {
        console.log('   - ID:', users[0].id);
        console.log('   - Nome:', users[0].name);
        console.log('   - Email:', users[0].email);
    } else {
        console.log('   ERRO: Usuario nao encontrado!');
        return;
    }

    // Verificar membership
    const members = await sql`
    SELECT m.*, o.name as org_name, o.slug 
    FROM members m 
    JOIN organizations o ON m.organization_id = o.id 
    WHERE m.user_id = ${users[0].id}
  `;
    console.log('\n2. Membros de organizacoes:');
    if (members.length > 0) {
        for (const m of members) {
            console.log('   - Org:', m.org_name, '(slug:', m.slug + ')');
            console.log('   - Role:', m.role);
        }
    } else {
        console.log('   ERRO: Nao eh membro de nenhuma org!');
        return;
    }

    console.log('\n' + '='.repeat(50));
    console.log('SUCESSO! Usuario pode fazer login com Google OAuth');
    console.log('Email:', EMAIL);
}

verify().catch(console.error);
