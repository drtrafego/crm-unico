-- =============================================================================
-- Migration 0002: rastreamento da origem de criação dos leads
-- =============================================================================
-- Objetivo: diferenciar no histórico quando o lead foi criado manualmente, via
-- API do site do cliente, via webhook público, ou via integrações Meta/UAZapi.
--
-- O trigger anterior (0001_audit_trigger.sql) gravava sempre o mesmo texto
-- "Lead criado automaticamente (Auditoria de Banco de Dados)" para qualquer
-- INSERT, escondendo a origem real. Esta migration:
--   1. Adiciona a coluna leads.created_via
--   2. Reescreve a function log_lead_changes para usar essa coluna no details
-- =============================================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS created_via text;

CREATE OR REPLACE FUNCTION log_lead_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO lead_history (lead_id, action, to_column, details, created_at)
        VALUES (
            NEW.id,
            'create',
            NEW.column_id,
            CASE NEW.created_via
                WHEN 'manual_panel'    THEN 'Criado manualmente no painel'
                WHEN 'manual_admin'    THEN 'Criado pelo super admin'
                WHEN 'site_api'        THEN 'Recebido do site do cliente (via API autenticada)'
                WHEN 'webhook_public'  THEN 'Recebido via webhook público (possível bot ou integração externa)'
                WHEN 'meta_whatsapp'   THEN 'Recebido via WhatsApp (Meta)'
                WHEN 'meta_messenger' THEN 'Recebido via Messenger'
                WHEN 'meta_instagram' THEN 'Recebido via Instagram Direct'
                WHEN 'uazapi'          THEN 'Recebido via WhatsApp (UAZapi)'
                ELSE 'Criado (origem não identificada)'
            END,
            NOW()
        );
        RETURN NEW;

    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.column_id IS DISTINCT FROM NEW.column_id) THEN
            INSERT INTO lead_history (lead_id, action, from_column, to_column, details, created_at)
            VALUES (NEW.id, 'move', OLD.column_id, NEW.column_id, 'Lead movido de coluna', NOW());
        END IF;

        IF (OLD.name IS DISTINCT FROM NEW.name) THEN
            INSERT INTO lead_history (lead_id, action, details, created_at)
            VALUES (NEW.id, 'update', 'Nome alterado de "' || OLD.name || '" para "' || NEW.name || '"', NOW());
        END IF;

        IF (OLD.email IS DISTINCT FROM NEW.email) THEN
            INSERT INTO lead_history (lead_id, action, details, created_at)
            VALUES (NEW.id, 'update', 'Email alterado de "' || COALESCE(OLD.email, 'vazio') || '" para "' || COALESCE(NEW.email, 'vazio') || '"', NOW());
        END IF;

        IF (OLD.whatsapp IS DISTINCT FROM NEW.whatsapp) THEN
            INSERT INTO lead_history (lead_id, action, details, created_at)
            VALUES (NEW.id, 'update', 'WhatsApp alterado de "' || COALESCE(OLD.whatsapp, 'vazio') || '" para "' || COALESCE(NEW.whatsapp, 'vazio') || '"', NOW());
        END IF;

        IF (OLD.notes IS DISTINCT FROM NEW.notes) THEN
            INSERT INTO lead_history (lead_id, action, details, created_at)
            VALUES (NEW.id, 'update', 'Anotações atualizadas', NOW());
        END IF;

        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_leads_trigger ON leads;
CREATE TRIGGER audit_leads_trigger
AFTER INSERT OR UPDATE ON leads
FOR EACH ROW
EXECUTE FUNCTION log_lead_changes();
