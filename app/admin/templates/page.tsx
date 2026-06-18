import { listTemplates, type TemplateRow } from "./actions";
import TemplatesManager from "./TemplatesManager";

export const dynamic = "force-dynamic";

export default async function AdminTemplatesPage() {
  const { rows, migrationMissing } = await listTemplates();
  return <TemplatesManager rows={rows} migrationMissing={migrationMissing} />;
}
