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
import { emailTranslator } from "@/emails/translator";
import type { Locale } from "@/lib/locale";

/** `locale` defaults to English for the react-email preview, which renders without props. */
interface PasswordResetEmailProps {
  locale: Locale;
  name: string | null;
  url: string;
}

export function PasswordResetEmail({ locale = "en", name, url }: Readonly<PasswordResetEmailProps>) {
  const t = emailTranslator(locale);
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{t("passwordReset.preview")}</Preview>
      <Body style={styles.body}>
        <Container style={styles.card}>
          <Section>
            <span style={styles.logo}>{"</>"}</span>
            <Text style={{ ...styles.brand, marginTop: "10px" }}>Cortex</Text>
          </Section>

          <Heading as="h1" style={styles.heading}>
            {t("passwordReset.heading")}
          </Heading>
          <Text style={styles.text}>{name ? t("greetingNamed", { name }) : t("greeting")}</Text>
          <Text style={styles.text}>{t("passwordReset.body")}</Text>

          <Section style={styles.buttonWrap}>
            <Button href={url} style={styles.button}>
              {t("passwordReset.button")}
            </Button>
          </Section>

          <Text style={styles.small}>{t("passwordReset.linkHelp")}</Text>
          <Link href={url} style={styles.url}>
            {url}
          </Link>

          <Hr style={styles.hr} />
          <Text style={styles.footer}>{t("passwordReset.footer")}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default PasswordResetEmail;
