import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "EpubAnything — Convert any URL to EPUB"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0f0e0d",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "serif",
        }}
      >
        <div style={{ color: "#c8a96e", fontSize: 32, letterSpacing: 8, marginBottom: 16 }}>
          ✦ ✦ ✦
        </div>
        <div style={{ color: "#f5f0e8", fontSize: 72, fontWeight: 600, letterSpacing: 2 }}>
          EpubAnything
        </div>
        <div
          style={{
            color: "#a89070",
            fontSize: 32,
            marginTop: 24,
            letterSpacing: 1,
          }}
        >
          Convert any URL to EPUB for your e-reader
        </div>
        <div style={{ color: "#c8a96e", fontSize: 24, marginTop: 40, letterSpacing: 4 }}>
          epubanything.site
        </div>
      </div>
    ),
    { ...size }
  )
}
