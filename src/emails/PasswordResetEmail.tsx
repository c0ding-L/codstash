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

interface PasswordResetEmailProps {
  name: string | null;
  url: string;
}

export function PasswordResetEmail({ name, url }: Readonly<PasswordResetEmailProps>) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Reset your CodStash password</Preview>
      <Body style={styles.body}>
        <Container style={styles.card}>
          <Section>
            <span style={styles.logo}>{"</>"}</span>
            <Text style={{ ...styles.brand, marginTop: "10px" }}>CodStash</Text>
          </Section>

          <Heading as="h1" style={styles.heading}>
            Reset your password
          </Heading>
          <Text style={styles.text}>{name ? `Hi ${name},` : "Hi,"}</Text>
          <Text style={styles.text}>
            Someone asked to reset the password for your CodStash account. Choose a new one with
            the button below.
          </Text>

          <Section style={styles.buttonWrap}>
            <Button href={url} style={styles.button}>
              Choose a new password
            </Button>
          </Section>

          <Text style={styles.small}>
            This link works once and expires in 1 hour. If the button does not work, copy this
            address into your browser:
          </Text>
          <Link href={url} style={styles.url}>
            {url}
          </Link>

          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            If you did not ask for this, you can safely ignore this email. Your password stays the
            same.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default PasswordResetEmail;
