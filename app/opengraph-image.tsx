import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 20% 20%, rgba(20,184,166,.35), transparent 26%), linear-gradient(135deg, #071b33 0%, #123765 58%, #0f766e 100%)",
          color: "white",
          fontFamily: "Inter, Arial, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(rgba(255,255,255,.16) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            opacity: 0.38,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 34, zIndex: "1" }}>
          <div
            style={{
              width: 132,
              height: 132,
              borderRadius: 32,
              background: "linear-gradient(135deg, #1e5fa3, #13406f 58%, #1cb7b3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 24px 80px rgba(0,0,0,.3)",
            }}
          >
            <svg width="88" height="88" viewBox="0 0 32 32" fill="none">
              <path d="M9 18.5 14.5 9l4.2 7.2 2.1-3.7L25 20H7l2-1.5Z" fill="white" fillOpacity=".94" />
              <circle cx="22.5" cy="9.5" r="2.25" fill="#55e0dc" />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 78, fontWeight: 700, letterSpacing: "-0.04em" }}>
              Actualizer
            </div>
            <div style={{ marginTop: 12, fontSize: 32, color: "rgba(255,255,255,.78)" }}>
              AI intake infrastructure for healthcare teams
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
