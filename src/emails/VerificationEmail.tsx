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

interface VerificationEmailProps {
  name: string | null;
  url: string;
}

export function VerificationEmail({ name, url }: Readonly<VerificationEmailProps>) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Confirm your email to activate your Cortex account</Preview>
      <Body style={styles.body}>
        <Container style={styles.card}>
          <Section>
            <span style={styles.logo}>{"</>"}</span>
            <Text style={{ ...styles.brand, marginTop: "10px" }}>Cortex</Text>
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
            If you did not create a Cortex account, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default VerificationEmail;
