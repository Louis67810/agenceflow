import type { CSSProperties } from "react";
import { MoveRight } from "lucide-react";

export type CarouselSlideKind = "context" | "step" | "argument-blue" | "argument-red" | "cta" | "before-after" | "why-design" | "avis" | "image" | "free";

export type CarouselSlidePayload = {
  kind: CarouselSlideKind;
  label: string;
  stepNumber?: number;
  pointNumber?: number;
  title?: string;
  subtitle?: string;
  body?: string;
  result?: string;
  showResult?: boolean;
  showCheck?: boolean;
  showStepCta?: boolean;
  stepCtaText?: string;
  imageMode?: "frame" | "full";
  imageSource?: "manual" | "ai";
  imageUrl?: string;
  beforeImage?: string;
  afterImage?: string;
  backgroundImage1?: string;
  backgroundImage2?: string;
};

export function decodeCarouselSlide(value: string): CarouselSlidePayload | null {
  if (!value.startsWith("__AF_CAROUSEL_SLIDE__")) return null;
  try {
    return JSON.parse(value.replace("__AF_CAROUSEL_SLIDE__", "")) as CarouselSlidePayload;
  } catch {
    return null;
  }
}

function assetUrl(src: string, assetPrefix?: string) {
  if (!src) return src;
  if (!assetPrefix) return src;
  if (src.startsWith("data:") || src.startsWith("blob:") || src.startsWith("http://") || src.startsWith("https://")) return src;
  if (!src.startsWith("/")) return src;
  return `${assetPrefix}${src}`;
}

export function CarouselSlideCanvas({
  payload,
  raw,
  scale = 1,
  assetPrefix,
}: {
  payload: CarouselSlidePayload | null;
  raw: string;
  scale?: number;
  assetPrefix?: string;
}) {
  const data = payload ?? { kind: "context" as CarouselSlideKind, label: "Slide", body: raw };
  const isRed = data.kind === "argument-red";
  const accent = isRed ? "#EF0C0C" : "#0147FF";
  const gradient = isRed
    ? "linear-gradient(89.57deg, #EF0C0C -1.45%, #FE5454 54.17%, #F01717 95.71%)"
    : "linear-gradient(95.73deg, #0147FF 25.27%, #376EFF 45.55%, #0147FF 67.55%)";

  const card: CSSProperties = {
    width: 575,
    height: 690,
    position: "relative",
    background: "#F6F6F6",
    overflow: "hidden",
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    color: "#121A2E",
    transform: `scale(${scale})`,
    transformOrigin: "top left",
  };
  const noDragImage: CSSProperties & { WebkitUserDrag?: string } = {
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitUserDrag: "none",
    pointerEvents: "none",
  };

  const logo = (
    <div style={{ position: "absolute", top: 20, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
      <img src={assetUrl("/linkedin/logo-ruff-agency.png", assetPrefix)} alt="RUFF Agency" style={{ height: 64, objectFit: "contain" }} />
    </div>
  );
  const leftBars = (
    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
      <img src={assetUrl("/linkedin/bars-left.svg", assetPrefix)} alt="" style={{ height: "100%", width: "auto", objectFit: "contain" }} />
    </div>
  );
  const rightBars = (
    <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
      <img src={assetUrl("/linkedin/bars-right.svg", assetPrefix)} alt="" style={{ height: "100%", width: "auto", objectFit: "contain" }} />
    </div>
  );
  const swipeCta = (
    <img
      src={assetUrl("/linkedin/swipe-cta.png", assetPrefix)}
      alt="Swipe"
      style={{
        position: "absolute",
        right: 52,
        bottom: -10,
        height: 50,
        objectFit: "contain",
        zIndex: 10,
        marginBottom: 0,
      }}
    />
  );
  const footer = (
    <div style={{ position: "absolute", left: 52, right: 52, bottom: 4, height: 56, display: "flex", alignItems: "flex-end", justifyContent: "flex-start", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <img src={assetUrl("/linkedin/profile.jpg", assetPrefix)} alt="Louis Staub" style={{ width: 46, height: 46, borderRadius: 999, border: "1.72px solid #fff", objectFit: "cover", boxShadow: "0 21px 8.2px rgba(0,0,0,0.01), 0 11.71px 7.03px rgba(0,0,0,0.05), 0 4.68px 4.68px rgba(0,0,0,0.09), 0 1.17px 2.34px rgba(0,0,0,0.1)" }} />
        <span style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 2 }}>
          <strong style={{ display: "block", fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700, fontSize: 13.33, lineHeight: "16px", color: "#121A2E" }}>Louis Staub</strong>
          <span style={{ display: "block", fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700, fontSize: 11.5, lineHeight: "15px", color: "#121A2E" }}>J&apos;optimise le taux de conversion de ta landing page</span>
        </span>
      </div>
    </div>
  );
  const simpleArrowCard = (
    <span style={{ marginTop: 16, width: 65, height: 45, borderRadius: 8, background: "#fff", color: "#000", display: "grid", placeItems: "center" }}>
      <MoveRight size={30} strokeWidth={2.8} style={{ color: "#000000" }} />
    </span>
  );
  const contextArrowCard = (
    <span style={{ marginTop: 24, width: "fit-content", maxWidth: 446.08, height: 55.24, borderRadius: 37.4571, background: "#000", color: "#fff", display: "flex", flexDirection: "row", alignItems: "center", padding: "8px 8px 8px 24px", gap: 16, boxShadow: "0px 15.1365px 6.0546px rgba(0,0,0,0.02), 0px 8.64943px 5.18966px rgba(0,0,0,0.08), 0px 3.89224px 3.89224px rgba(0,0,0,0.13), 0px 0.864943px 2.16236px rgba(0,0,0,0.15), inset 0px 3.56735px 9.89939px rgba(255,255,255,0.25)" }}>
      <span style={{ maxWidth: 341, fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700, fontSize: 22, lineHeight: "106.29%", letterSpacing: "-0.02em", color: "#fff", textShadow: "0px 0.919392px 1.60894px rgba(0,0,0,0.19)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left" }}>{data.stepCtaText || "Voici les 3 etapes pour y remedier"}</span>
      <span style={{ width: 57.08, height: 39.24, borderRadius: 32.1061, background: "#fff", color: "#000", display: "grid", placeItems: "center", boxShadow: "0px 6.03849px 6.03849px rgba(0,0,0,0.25)", flexShrink: 0 }}>
        <MoveRight size={31} strokeWidth={2.4} style={{ color: "#000", filter: "drop-shadow(0px 1.50962px 3px rgba(0,0,0,0.25))" }} />
      </span>
    </span>
  );

  if (data.kind === "cta") {
    return (
      <div style={card} data-carousel-slide-inner>
        {leftBars}
        {rightBars}
        <img draggable={false} src={assetUrl("/linkedin/slide-cta-reference.jpg", assetPrefix)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", ...noDragImage }} />
      </div>
    );
  }

  if (data.kind === "before-after" || data.kind === "avis") {
    return (
      <div style={card} data-carousel-slide-inner>
        {leftBars}
        {rightBars}
        {logo}
        {data.kind === "avis" && <div style={{ position: "absolute", left: 68, right: 68, top: 82, height: 69, borderRadius: 15, background: "#fff", border: "1px solid rgba(0,0,0,0.16)", boxShadow: "0 9px 4px rgba(26,26,26,0.01), 0 5px 3px rgba(26,26,26,0.03), 0 2px 2px rgba(26,26,26,0.04), 0 1px 1px rgba(26,26,26,0.05)", display: "grid", placeItems: "center", fontSize: 31, fontWeight: 700 }}>{data.title || "Tu preferes quelle version ?"}</div>}
        <div style={{ position: "absolute", left: 86, right: data.kind === "avis" ? 156 : 86, top: data.kind === "avis" ? 184 : 92, height: data.kind === "avis" ? 204 : 243, borderRadius: 16, background: "#fff", border: "1px solid rgba(0,0,0,0.18)", boxShadow: "0 17px 17px rgba(59,59,59,0.01), 0 10px 6px rgba(59,59,59,0.03), 0 4px 4px rgba(59,59,59,0.05), 0 1px 2px rgba(59,59,59,0.06)", overflow: "hidden" }}>
          {data.beforeImage ? <img src={assetUrl(data.beforeImage, assetPrefix)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
        </div>
        <div style={{ position: "absolute", left: 86, right: data.kind === "avis" ? 156 : 86, top: data.kind === "avis" ? 405 : 353, height: data.kind === "avis" ? 204 : 243, borderRadius: 16, background: "#fff", border: "1px solid rgba(0,0,0,0.18)", boxShadow: "0 17px 17px rgba(59,59,59,0.01), 0 10px 6px rgba(59,59,59,0.03), 0 4px 4px rgba(59,59,59,0.05), 0 1px 2px rgba(59,59,59,0.06)", overflow: "hidden" }}>
          {data.afterImage ? <img src={assetUrl(data.afterImage, assetPrefix)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
        </div>
        {data.kind === "avis" && (
          <>
            <img src={assetUrl("/linkedin/clap.svg", assetPrefix)} alt="" style={{ position: "absolute", right: 22, top: 223, width: 126, height: 126, objectFit: "contain", zIndex: 8 }} />
            <img src={assetUrl("/linkedin/heart.svg", assetPrefix)} alt="" style={{ position: "absolute", right: 22, top: 452, width: 126, height: 126, objectFit: "contain", zIndex: 8 }} />
            <img src={assetUrl("/linkedin/hand-point.png", assetPrefix)} alt="" style={{ position: "absolute", right: -12, top: 288, width: 224, height: "auto", objectFit: "contain", zIndex: 7 }} />
          </>
        )}
        {data.kind === "before-after" && <span style={{ position: "absolute", right: 72, top: 300, border: "1px solid #0147FF", borderRadius: 999, background: "#fff", padding: "10px 16px", fontWeight: 700, fontSize: 12, boxShadow: "0 17px 17px rgba(59,59,59,0.01), 0 10px 6px rgba(59,59,59,0.03), 0 4px 4px rgba(59,59,59,0.05), 0 1px 2px rgba(59,59,59,0.06)", whiteSpace: "nowrap", zIndex: 5 }}>Ancienne version du site</span>}
        {data.kind === "before-after" && <span style={{ position: "absolute", right: 72, top: 563, border: "1px solid #0147FF", borderRadius: 999, background: "#fff", padding: "10px 16px", fontWeight: 700, fontSize: 12, boxShadow: "0 17px 17px rgba(59,59,59,0.01), 0 10px 6px rgba(59,59,59,0.03), 0 4px 4px rgba(59,59,59,0.05), 0 1px 2px rgba(59,59,59,0.06)", whiteSpace: "nowrap", zIndex: 5 }}>Nouvelle version du site</span>}
        {swipeCta}{footer}
      </div>
    );
  }

  if (data.kind === "why-design") {
    return (
      <div style={card} data-carousel-slide-inner>
        {leftBars}
        {rightBars}
        {logo}
        <div style={{ position: "absolute", left: 86, top: 184, width: 403, minHeight: 178, borderRadius: 21, background: "#0147FF", color: "#fff", padding: 24, boxShadow: "0 2px 3.96px rgba(0,0,0,0.19)" }}>
          <h2 style={{ margin: 0, fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 32, lineHeight: 1.06, letterSpacing: "-0.02em", textAlign: "left", fontWeight: 700 }}>{data.body || data.title}</h2>
          {simpleArrowCard}
        </div>
        {swipeCta}{footer}
      </div>
    );
  }

  if (data.kind === "step") {
    return (
      <div style={card} data-carousel-slide-inner>
        {leftBars}
        {rightBars}
        {logo}
        <div style={{ position: "absolute", left: 86, top: 184, width: 403, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 15 }}>
          <div style={{ display: "inline-flex", alignItems: "center", height: 97, borderRadius: 26, background: "#fff", border: "1px solid rgba(0,0,0,0.22)", padding: "0 26px", fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 56, fontWeight: 700, color: "#121A2E", letterSpacing: "-0.02em", boxShadow: "0 9px 4px rgba(26,26,26,0.01), 0 5px 3px rgba(26,26,26,0.03), 0 2px 2px rgba(26,26,26,0.04), 0 1px 1px rgba(26,26,26,0.05)" }}>
            Etape {data.stepNumber || 1}
          </div>
          <div style={{ minHeight: 82, borderRadius: 19, background: "#0147FF", color: "#fff", display: "inline-flex", alignItems: "center", padding: "16px 24px", fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", boxShadow: "0 18px 24px rgba(10,132,255,0.08)", textAlign: "left" }}>
            {data.title}
          </div>
        </div>
        {swipeCta}{footer}
      </div>
    );
  }

  if (data.kind === "free") {
    return (
      <div style={card} data-carousel-slide-inner>
        {leftBars}
        {rightBars}
        {logo}
        <div style={{ position: "absolute", left: 86, top: 112, width: 403, height: 488, borderRadius: 24, border: "1.5px dashed rgba(18,26,46,0.18)", background: "linear-gradient(45deg, rgba(255,255,255,0.72) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.72) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.72) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.72) 75%)", backgroundSize: "28px 28px", backgroundPosition: "0 0, 0 14px, 14px -14px, -14px 0", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(18,26,46,0.42)", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>
          Libre
        </div>
        {swipeCta}{footer}
      </div>
    );
  }

  if (data.kind === "image") {
    return (
      <div style={card} data-carousel-slide-inner>
        {leftBars}
        {rightBars}
        {data.imageUrl ? (
          <img src={assetUrl(data.imageUrl, assetPrefix)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, border: "3px dashed rgba(18,26,46,0.18)", background: "#f2f2f2", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(18,26,46,0.42)", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Image
          </div>
        )}
      </div>
    );
  }

  if (data.kind === "argument-blue" || data.kind === "argument-red") {
    return (
      <div style={card} data-carousel-slide-inner>
        {leftBars}
        {rightBars}
        {logo}
        <div style={{ position: "absolute", left: 86, top: 98, width: 403, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 66, height: 65, borderRadius: 15, background: "#e5e5e5", border: "1px solid rgba(0,0,0,0.06)", display: "grid", placeItems: "center" }}>
              <span style={{ width: 56, height: 56, borderRadius: 11, background: "#fff", display: "grid", placeItems: "center", fontFamily: "Inter, sans-serif", fontSize: 31.86, fontWeight: 700, color: "#121A2E", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "inset 0 2.93px 2.93px rgba(255,255,255,0.25), inset 0 -2.93px 1.61px rgba(0,0,0,0.09), 0 5.87px 2.2px rgba(0,0,0,0.02), 0 2.93px 2.2px rgba(0,0,0,0.08), 0 1.47px 1.47px rgba(0,0,0,0.13)" }}>{data.pointNumber || 1}</span>
            </span>
            <span style={{ minHeight: 60, borderRadius: 14, background: gradient, color: "#fff", display: "inline-flex", alignItems: "center", padding: "0 20px", fontSize: 26, lineHeight: 1.06, fontWeight: 700, boxShadow: isRed ? "0 24px 9.38px rgba(150,13,13,0.02), 0 13.39px 8.04px rgba(150,13,13,0.08), 0 6.03px 6.03px rgba(150,13,13,0.13), 0 1.34px 3.35px rgba(150,13,13,0.15)" : "0 24px 9.38px rgba(1,71,255,0.02), 0 13.39px 8.04px rgba(1,71,255,0.08), 0 6.03px 6.03px rgba(1,71,255,0.13), 0 1.34px 3.35px rgba(1,71,255,0.15)" }}>{data.title || ""}</span>
          </div>
          <p style={{ margin: "12px 0 0", minHeight: 99, fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 21, lineHeight: 1.58, fontWeight: 700, letterSpacing: "-0.02em", color: "rgba(18,26,46,0.8)", textAlign: "left" }}>{data.subtitle}</p>
          <div style={{ position: "relative", marginTop: 12, height: 264, borderRadius: data.imageMode === "full" ? 0 : 16, background: "#fff", border: data.imageMode === "full" ? "none" : "1px solid rgba(0,0,0,0.1)", overflow: data.showCheck === false ? "hidden" : "visible" }}>
            {data.imageUrl ? <img src={assetUrl(data.imageUrl, assetPrefix)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
            {data.showCheck !== false && (
              <img
                src={assetUrl(isRed ? "/linkedin/croix.png" : "/linkedin/check.png", assetPrefix)}
                alt=""
                style={{ position: "absolute", right: -10, top: -12, width: 52, height: 52, objectFit: "contain", display: "block" }}
              />
            )}
          </div>
          {data.showResult && (
            <p style={{ margin: "16px 0 0", display: "flex", alignItems: "center", gap: 16, fontSize: 18, lineHeight: 1.34, fontWeight: 700 }}>
              <MoveRight size={24} strokeWidth={3} style={{ color: accent }} />
              {data.result}
            </p>
          )}
        </div>
        {swipeCta}{footer}
      </div>
    );
  }

  return (
    <div style={card} data-carousel-slide-inner>
      {leftBars}
      {rightBars}
      {logo}
      <div style={{ position: "absolute", left: 69, top: 118, width: 437, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <div style={{ display: "inline-flex", alignItems: "center", minHeight: 73, borderRadius: 20, background: "#fff", border: "1px solid rgba(0,0,0,0.22)", padding: "0 20px", fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 42, fontWeight: 700, color: "#121A2E", letterSpacing: "-0.02em", boxShadow: "0 9px 4px rgba(26,26,26,0.01), 0 5px 3px rgba(26,26,26,0.03), 0 2px 2px rgba(26,26,26,0.04), 0 1px 1px rgba(26,26,26,0.05)" }}>
          Contexte
        </div>
        <p style={{ margin: "24px 0 0", width: 437, maxWidth: 437, whiteSpace: "pre-line", fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 31, lineHeight: 1.31, fontWeight: 700, letterSpacing: "-0.02em", color: "rgba(18,26,46,0.82)", textAlign: "left" }}>{data.subtitle || data.body || raw}</p>
        {data.showStepCta && (
          contextArrowCard
        )}
      </div>
      {swipeCta}{footer}
    </div>
  );
}
