export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-slate-900">Terms of Service</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: August 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-7 text-slate-700">
        <section>
          <h2 className="text-base font-semibold text-slate-900">1. Acceptance of Terms</h2>
          <p className="mt-2">
            By accessing or using this platform, you agree to be bound by these Terms of Service.
            If you do not agree, do not use the platform.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900">2. Use of the Platform</h2>
          <p className="mt-2">
            This platform is provided for business use by authorized users only. You agree not
            to misuse the platform, attempt unauthorized access, or use it for any unlawful purpose.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900">3. Accounts</h2>
          <p className="mt-2">
            You are responsible for maintaining the security of your account credentials. Notify
            us immediately at{" "}
            <a href="mailto:thomas@southwestdigital.io" className="text-blue-600 hover:underline">
              thomas@southwestdigital.io
            </a>{" "}
            if you suspect unauthorized access.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900">4. Intellectual Property</h2>
          <p className="mt-2">
            All content and software on this platform is owned by Southwest Digital Marketing.
            You may not copy, reproduce, or distribute any part of the platform without written
            permission.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900">5. Limitation of Liability</h2>
          <p className="mt-2">
            Southwest Digital Marketing is not liable for any indirect, incidental, or
            consequential damages arising from your use of the platform.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900">6. Changes to Terms</h2>
          <p className="mt-2">
            We may update these terms at any time. Continued use of the platform after changes
            constitutes acceptance of the new terms.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900">7. Contact</h2>
          <p className="mt-2">
            Questions about these Terms? Contact us at{" "}
            <a href="mailto:thomas@southwestdigital.io" className="text-blue-600 hover:underline">
              thomas@southwestdigital.io
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
