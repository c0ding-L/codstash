import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";

interface VerificationEmailProps {
  name: string | null;
  url: string;
}

// Inline styles on purpose: email clients ignore most stylesheets. The palette
// follows the app (near-black primary, neutral greys) on a light background,
// because dark backgrounds render unreliably across mail clients.
const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const styles = {
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

export function VerificationEmail({ name, url }: Readonly<VerificationEmailProps>) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Confirm your email to activate your CodStash account</Preview>
      <Body style={styles.body}>
        <Container style={styles.card}>
          <Section>
            <span style={styles.logo}>{"</>"}</span>
            <Text style={{ ...styles.brand, marginTop: "10px" }}>CodStash</Text>
          </Section>

          <Heading as="h1" style={styles.heading}>
            Verify your email
          </Heading>
          <Text style={styles.text}>{name ? `Hi ${name},` : "Hi,"}</Text>
          <Text style={styles.text}>
            Thanks for signing up. Confirm your email address to activate your account and start
            saving snippets, prompts, commands and notes.
          </Text>

          <Section style={styles.buttonWrap}>
            <Button href={url} style={styles.button}>
              Verify my email
            </Button>
          </Section>

          <Text style={styles.small}>
            This link works once and expires in 24 hours. If the button does not work, copy this
            address into your browser:
          </Text>
          <Link href={url} style={styles.url}>
            {url}
          </Link>

          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            If you did not create a CodStash account, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default VerificationEmail;
