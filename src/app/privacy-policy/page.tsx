export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-slate-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: August 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-7 text-slate-700">
        <section>
          <h2 className="text-base font-semibold text-slate-900">1. Information We Collect</h2>
          <p className="mt-2">
            We collect information you provide when you create an account or use our services,
            including your name, email address, and usage data. We also collect analytics data
            to help us improve the platform.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900">2. How We Use Your Information</h2>
          <p className="mt-2">
            We use your information to provide and improve our services, communicate with you,
            and ensure the security of your account. We do not sell your personal information
            to third parties.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900">3. Data Security</h2>
          <p className="mt-2">
            We take reasonable measures to protect your information from unauthorized access,
            disclosure, or destruction. However, no internet transmission is completely secure.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900">4. Third-Party Services</h2>
          <p className="mt-2">
            Our platform integrates with third-party services such as Google Analytics and
            YouTube. These services have their own privacy policies governing their use of
            your data.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900">5. Contact</h2>
          <p className="mt-2">
            If you have questions about this Privacy Policy, contact us at{" "}
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
