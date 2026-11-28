import { Img, Section, Text } from "react-email";

import { styles } from "@/emails/styles";

/**
 * The app's mark and name at the top of every email. The mark is `public/email-logo.png`, loaded
 * from the app the email links to: mail clients drop SVG and `data:` images. Without a usable
 * link (the react-email preview renders without props) only the name shows.
 */
export function EmailBrand({ appUrl }: Readonly<{ appUrl?: string }>) {
  const logoSrc = logoUrl(appUrl);
  return (
    <Section>
      {logoSrc ? <Img src={logoSrc} width="32" height="32" alt="" style={styles.logo} /> : null}
      <Text style={{ ...styles.brand, marginTop: logoSrc ? "10px" : 0 }}>Cortex</Text>
    </Section>
  );
}

function logoUrl(appUrl: string | undefined) {
  if (!appUrl) return null;
  try {
    return new URL("/email-logo.png", appUrl).href;
  } catch {
    return null;
  }
}
