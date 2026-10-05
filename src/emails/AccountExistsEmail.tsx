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

import { styles } from "@/emails/styles";

interface AccountExistsEmailProps {
  name: string | null;
  signInUrl: string;
  /** Null for GitHub-only accounts, which have no password to reset. */
  resetUrl: string | null;
}

export function AccountExistsEmail({ name, signInUrl, resetUrl }: Readonly<AccountExistsEmailProps>) {
  return (
    <Html lang="en">
      <Head />
      <Preview>You already have a CodStash account</Preview>
      <Body style={styles.body}>
        <Container style={styles.card}>
          <Section>
            <span style={styles.logo}>{"</>"}</span>
            <Text style={{ ...styles.brand, marginTop: "10px" }}>CodStash</Text>
          </Section>

          <Heading as="h1" style={styles.heading}>
            You already have an account
          </Heading>
          <Text style={styles.text}>{name ? `Hi ${name},` : "Hi,"}</Text>
          <Text style={styles.text}>
            Someone tried to create a CodStash account with this email address, but it already
            has one.{" "}
            {resetUrl
              ? "Sign in with your password, or reset it if you have forgotten it."
              : "It signs in with GitHub."}
          </Text>

          <Section style={styles.buttonWrap}>
            <Button href={signInUrl} style={styles.button}>
              Sign in
            </Button>
          </Section>

          {resetUrl ? (
            <Text style={styles.small}>
              Forgot your password? <Link href={resetUrl} style={styles.url}>Reset it here</Link>.
            </Text>
          ) : null}

          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            If this was not you, you can safely ignore this email. Nothing about your account has
            changed.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default AccountExistsEmail;
