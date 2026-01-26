import { getAdminLeads, getAdminColumns, getAdminSettings } from "@/server/actions/admin-leads";
import { CrmView } from "@/components/features/crm/crm-view";
import {
    updateAdminLeadStatus,
    updateAdminColumnOrder,
    createAdminColumn,
    updateAdminColumn,
    deleteAdminColumn,
    createAdminLead,
    updateAdminLeadContent,
    deleteAdminLead
} from "@/server/actions/admin-leads";

export const dynamic = 'force-dynamic';

export default async function AdminCRMPage() {
    const orgId = "super-admin-personal"; // Fixed ID for Super Admin Personal CRM

    const [leads, columns, settings] = await Promise.all([
        getAdminLeads(),
        getAdminColumns(),
        getAdminSettings()
    ]);

    const overrides = {
        updateLeadStatus: updateAdminLeadStatus,
        updateColumnOrder: updateAdminColumnOrder,
        createColumn: createAdminColumn,
        updateColumn: updateAdminColumn,
        deleteColumn: deleteAdminColumn,
        createLead: createAdminLead,
        updateLeadContent: updateAdminLeadContent,
        deleteLead: deleteAdminLead
    };

    return (
        <div className="h-[calc(100vh-100px)]">
            <CrmView
                initialLeads={leads}
                columns={columns}
                companyName="Meus Leads (Super Admin)"
                initialViewMode={settings?.viewMode || 'kanban'}
                orgId={orgId}
                overrides={overrides}
            />
        </div>
    );
}
