import { listTemplates, templateSalesStats } from "./actions";
import TemplatesManager from "./TemplatesManager";

export const dynamic = "force-dynamic";

export default async function AdminTemplatesPage() {
  const [{ rows, migrationMissing }, salesResult] = await Promise.all([
    listTemplates(),
    templateSalesStats(),
  ]);
  const salesStats = salesResult.ok ? salesResult.stats : [];
  return <TemplatesManager rows={rows} migrationMissing={migrationMissing} salesStats={salesStats} />;
}
