import { CarouselSlideCanvas, decodeCarouselSlide } from "@/components/linkedin/CarouselSlideRender";

export const dynamic = "force-dynamic";

export default async function CarouselExportPage({
  searchParams,
}: {
  searchParams: Promise<{ slide?: string }>;
}) {
  const params = await searchParams;
  const slide = typeof params.slide === "string" ? params.slide : "";
  const payload = decodeCarouselSlide(slide);

  return (
    <main style={{ margin: 0, padding: 0, width: 575, height: 690, overflow: "hidden", background: "#F6F6F6" }}>
      <CarouselSlideCanvas payload={payload} raw={slide} />
    </main>
  );
}
