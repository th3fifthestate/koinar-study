import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#3d4f35",
          borderRadius: "32px",
        }}
      >
        <span
          style={{
            fontSize: 120,
            fontWeight: 700,
            color: "#fafaf9",
            fontFamily: "serif",
            lineHeight: 1,
            marginTop: "-4px",
          }}
        >
          K
        </span>
      </div>
    ),
    {
      ...size,
    }
  );
}
