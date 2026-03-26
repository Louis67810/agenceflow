import AccessForm from "./AccessForm";

export default async function AccessPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  return <AccessForm accessKey={key} />;
}
