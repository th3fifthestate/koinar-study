import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: "6px",
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#fafaf9",
            fontFamily: "serif",
            lineHeight: 1,
            marginTop: "-1px",
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
