import { ResponsibleDetailClient } from "./ResponsibleDetailClient";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResponsibleDetailClient id={id} />;
}
