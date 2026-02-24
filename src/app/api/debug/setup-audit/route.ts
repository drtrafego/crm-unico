import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        // 1. Create the function
        console.log("Criando função de log...");
        await db.execute(sql`
      CREATE OR REPLACE FUNCTION log_lead_changes()
      RETURNS TRIGGER AS $$
      DECLARE
          new_col_name TEXT;
          old_col_name TEXT; -- Added for logging old column title
      BEGIN
          -- Handle INSERT (New Lead)
          IF (TG_OP = 'INSERT') THEN
              SELECT title INTO new_col_name FROM columns WHERE id = NEW.column_id; -- Get column title for new lead
              INSERT INTO lead_history (lead_id, action, to_column, details, created_at)
              VALUES (
                  NEW.id, 
                  'create', 
                  NEW.column_id, 
                  'Lead criado automaticamente na coluna ' || COALESCE('"' || new_col_name || '"', 'desconhecida') || ' (Auditoria de Banco de Dados)',
                  NOW()
              );
              RETURN NEW;
          
          -- Handle UPDATE (Changes)
          ELSIF (TG_OP = 'UPDATE') THEN
              -- Only log if significant fields changed
              -- 1. Status/Column Change
              IF (OLD.column_id IS DISTINCT FROM NEW.column_id) THEN
                  SELECT title INTO new_col_name FROM columns WHERE id = NEW.column_id;
                  SELECT title INTO old_col_name FROM columns WHERE id = OLD.column_id; -- Get old column title
                  INSERT INTO lead_history (lead_id, action, from_column, to_column, details, created_at)
                  VALUES (
                      NEW.id,
                      'move',
                      OLD.column_id,
                      NEW.column_id,
                      'Lead movido para a coluna ' || COALESCE('"' || new_col_name || '"', 'desconhecida'),
                      NOW()
                  );
              END IF;

              -- 2. Name Change
              IF (OLD.name IS DISTINCT FROM NEW.name) THEN
                  INSERT INTO lead_history (lead_id, action, details, created_at)
                  VALUES (NEW.id, 'update', 'Nome alterado de "' || OLD.name || '" para "' || NEW.name || '"', NOW());
              END IF;

              -- 3. Email Change
              IF (OLD.email IS DISTINCT FROM NEW.email) THEN
                  INSERT INTO lead_history (lead_id, action, details, created_at)
                  VALUES (NEW.id, 'update', 'Email alterado de "' || COALESCE(OLD.email, 'vazio') || '" para "' || COALESCE(NEW.email, 'vazio') || '"', NOW());
              END IF;

              -- 4. WhatsApp Change
              IF (OLD.whatsapp IS DISTINCT FROM NEW.whatsapp) THEN
                  INSERT INTO lead_history (lead_id, action, details, created_at)
                  VALUES (NEW.id, 'update', 'WhatsApp alterado de "' || COALESCE(OLD.whatsapp, 'vazio') || '" para "' || COALESCE(NEW.whatsapp, 'vazio') || '"', NOW());
              END IF;

              -- 5. Notes Change
              IF (OLD.notes IS DISTINCT FROM NEW.notes) THEN
                  INSERT INTO lead_history (lead_id, action, details, created_at)
                  VALUES (NEW.id, 'update', 'Anotações atualizadas', NOW());
              END IF;

              RETURN NEW;
          END IF;
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

        // 2. Drop existing trigger
        console.log("Removendo trigger antigo...");
        await db.execute(sql`DROP TRIGGER IF EXISTS audit_leads_trigger ON leads;`);

        // 3. Create the trigger
        console.log("Criando novo trigger...");
        await db.execute(sql`
      CREATE TRIGGER audit_leads_trigger
      AFTER INSERT OR UPDATE ON leads
      FOR EACH ROW
      EXECUTE FUNCTION log_lead_changes();
    `);

        return NextResponse.json({ success: true, message: "Trigger de auditoria instalado com sucesso!" });
    } catch (error: any) {
        console.error("Failed to setup trigger:", error);
        return NextResponse.json({
            success: false,
            error: error.message || String(error),
            details: error.routine ? `Postgres Error: ${error.routine}` : undefined
        }, { status: 500 });
    }
}
