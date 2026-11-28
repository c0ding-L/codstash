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

import { EmailBrand } from "@/emails/EmailBrand";
import { styles } from "@/emails/styles";
import { emailTranslator } from "@/emails/translator";
import type { Locale } from "@/lib/locale";

/** `locale` defaults to English for the react-email preview, which renders without props. */
interface AccountExistsEmailProps {
  locale: Locale;
  name: string | null;
  signInUrl: string;
  /** Null for GitHub-only accounts, which have no password to reset. */
  resetUrl: string | null;
}

export function AccountExistsEmail({ locale = "en", name, signInUrl, resetUrl }: Readonly<AccountExistsEmailProps>) {
  const t = emailTranslator(locale);
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{t("accountExists.preview")}</Preview>
      <Body style={styles.body}>
        <Container style={styles.card}>
          <EmailBrand appUrl={signInUrl} />

          <Heading as="h1" style={styles.heading}>
            {t("accountExists.heading")}
          </Heading>
          <Text style={styles.text}>{name ? t("greetingNamed", { name }) : t("greeting")}</Text>
          <Text style={styles.text}>
            {t("accountExists.body")}{" "}
            {resetUrl ? t("accountExists.withPassword") : t("accountExists.withGithub")}
          </Text>

          <Section style={styles.buttonWrap}>
            <Button href={signInUrl} style={styles.button}>
              {t("accountExists.button")}
            </Button>
          </Section>

          {resetUrl ? (
            <Text style={styles.small}>
              {t.rich("accountExists.forgot", {
                link: (chunks) => (
                  <Link href={resetUrl} style={styles.url}>
                    {chunks}
                  </Link>
                ),
              })}
            </Text>
          ) : null}

          <Hr style={styles.hr} />
          <Text style={styles.footer}>{t("accountExists.footer")}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default AccountExistsEmail;
