// Inline styles on purpose: email clients ignore most stylesheets. The palette
// follows the app (near-black primary, neutral greys) on a light background,
// because dark backgrounds render unreliably across mail clients.
const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export const styles = {
  body: { backgroundColor: "#f4f4f5", margin: 0, padding: "32px 12px", fontFamily: font },
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #e4e4e7",
    borderRadius: "12px",
    maxWidth: "480px",
    padding: "32px",
  },
  logo: {
    backgroundColor: "#171717",
    borderRadius: "8px",
    color: "#ffffff",
    display: "inline-block",
    fontFamily: "'SFMono-Regular', Menlo, Consolas, monospace",
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: "32px",
    textAlign: "center" as const,
    width: "32px",
    height: "32px",
  },
  brand: { color: "#171717", fontSize: "16px", fontWeight: 600, margin: 0 },
  heading: { color: "#171717", fontSize: "22px", fontWeight: 600, lineHeight: "28px", margin: "28px 0 12px" },
  text: { color: "#3f3f46", fontSize: "15px", lineHeight: "24px", margin: "0 0 16px" },
  buttonWrap: { margin: "24px 0" },
  button: {
    backgroundColor: "#171717",
    borderRadius: "8px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "15px",
    fontWeight: 600,
    padding: "12px 24px",
    textDecoration: "none",
  },
  small: { color: "#71717a", fontSize: "13px", lineHeight: "20px", margin: "0 0 8px" },
  url: { color: "#52525b", fontSize: "12px", lineHeight: "18px", wordBreak: "break-all" as const },
  hr: { borderColor: "#e4e4e7", margin: "24px 0" },
  footer: { color: "#a1a1aa", fontSize: "12px", lineHeight: "18px", margin: 0 },
};
