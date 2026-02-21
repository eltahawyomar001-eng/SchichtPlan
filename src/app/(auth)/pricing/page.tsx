import { useTranslations } from "next-intl";
import Link from "next/link";

export default function PricingPage() {
  return <PricingContent />;
}

function PricingContent() {
  const t = useTranslations("pricing");

  const plans = [
    {
      name: t("free"),
      price: "0€",
      period: t("perMonth"),
      description: t("freeDesc"),
      features: [
        t("featureFree1"),
        t("featureFree2"),
        t("featureFree3"),
        t("featureFree4"),
      ],
      cta: t("getStarted"),
      href: "/register",
      highlighted: false,
    },
    {
      name: t("pro"),
      price: "9€",
      period: t("perMonth"),
      description: t("proDesc"),
      features: [
        t("featurePro1"),
        t("featurePro2"),
        t("featurePro3"),
        t("featurePro4"),
        t("featurePro5"),
        t("featurePro6"),
      ],
      cta: t("startTrial"),
      href: "/register",
      highlighted: true,
    },
    {
      name: t("enterprise"),
      price: t("custom"),
      period: "",
      description: t("enterpriseDesc"),
      features: [
        t("featureEnt1"),
        t("featureEnt2"),
        t("featureEnt3"),
        t("featureEnt4"),
        t("featureEnt5"),
      ],
      cta: t("contactUs"),
      href: "mailto:info@schichtplan.app",
      highlighted: false,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-5xl mx-auto px-4 py-16 sm:py-24">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            {t("title")}
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-8 shadow-sm flex flex-col ${
                plan.highlighted
                  ? "border-violet-500 ring-2 ring-violet-500 bg-white"
                  : "border-gray-200 bg-white"
              }`}
            >
              {plan.highlighted && (
                <span className="inline-block self-start rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 mb-4">
                  {t("popular")}
                </span>
              )}
              <h2 className="text-xl font-bold text-gray-900">{plan.name}</h2>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-gray-900">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-gray-500">/{plan.period}</span>
                )}
              </div>
              <p className="mt-3 text-sm text-gray-600">{plan.description}</p>
              <ul className="mt-6 space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span className="text-gray-700">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`mt-8 block w-full rounded-lg py-3 text-center text-sm font-semibold transition-colors ${
                  plan.highlighted
                    ? "bg-violet-600 text-white hover:bg-violet-700"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
