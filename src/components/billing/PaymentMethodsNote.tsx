import { useTranslations } from "next-intl";

import { PAYMENT_METHODS, type Currency } from "@/lib/billing-plans";

/** The ways to pay in this currency, under the pricing switches. */
export function PaymentMethodsNote({ currency, className }: { currency: Currency; className?: string }) {
  const t = useTranslations("billing");
  return (
    <p className={className}>
      {t(`paymentMethods.${PAYMENT_METHODS[currency]}`)}
      {currency === "XOF" ? t("westAfrica") : null}
    </p>
  );
}
