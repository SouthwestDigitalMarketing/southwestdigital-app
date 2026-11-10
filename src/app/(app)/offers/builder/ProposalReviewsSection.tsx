"use client";

import { useEffect, useRef, useState } from "react";

const REVIEWS = [
  {
    name: "Sara Manore",
    detail: "Local Guide · 16 reviews",
    ago: "recently",
    image: null as string | null,
    text: "Thomas is a gem! He got me out of a pickle on an audit! So grateful!!!!",
  },
  {
    name: "Chris Saltzburg",
    detail: "CPYB Yacht Sales & Brokerage · Local Guide · 109 reviews",
    ago: "9 months ago",
    image: null as string | null,
    text: "I'm hesitant to write this review, because finding a qualified, trustworthy, and easy to work with bookkeeper is incredibly difficult. (& Selfishly, I don't want Conroe to get too busy!) However, you can streamline your search for quality Bookkeeping services by calling Conroe. Highly recommend.",
  },
  {
    name: "Dagny Yznaga Gaerste",
    detail: "Local Guide · 21 reviews",
    ago: "a year ago",
    image: "https://www.bookkeepingconroe.com/images/google-review-profile-pics/Dagny-Yznaga.png" as string | null,
    text: "I met Tom through business and now he's become a friend. He has outstanding and up-to-date bookkeeping knowledge. He is a loyal and reliable professional who treats all his clients in the best possible way; with transparency, clarity and proper communication. I own a similar business and every time I get a Quickbooks client, I send them to Bookkeeping For My Business and they've never let me down. 100% recommended",
  },
  {
    name: "Chelsea Gronemeyer",
    detail: "1 review",
    ago: "a year ago",
    image: "https://www.bookkeepingconroe.com/images/google-review-profile-pics/Chelsea-Gronemeyer.png" as string | null,
    text: "Tom is very knowledgeable about bookkeeping and he is always willing to help out with any questions or concerns I may have. I really feel like he puts his clients first and I wouldn’t want to work with anyone else.",
  },
  {
    name: "Giorgio Villani",
    detail: "6 reviews",
    ago: "a year ago",
    image: "https://www.bookkeepingconroe.com/images/google-review-profile-pics/giorgio-villani.png" as string | null,
    text: "Tom’s consultation made it clear how proper bookkeeping is key to financial planning and strategic decisions. He explained how accurate records improve cash flow forecasting, budgeting, and tax prep. His clear communication helped me understand how to use financial data for smarter business actions. Highly recommended!",
  },
  {
    name: "Stephen MacDonald",
    detail: "5 reviews · 2 photos",
    ago: "a year ago",
    image: null as string | null,
    text: "Tom and I have had numerous discussions about my bookkeeping services and he has always been generous with his time and knowledge! I believe that he has his clients best interests in mind and I wouldn’t choose to work with anyone else.",
  },
  {
    name: "Geoff Lohnes",
    detail: "12 reviews",
    ago: "a year ago",
    image: "https://www.bookkeepingconroe.com/images/google-review-profile-pics/geoff-lohnes.png" as string | null,
    text: "I’ve been working with Thomas lately, and I’m blown away by his vast knowledge of bookkeeping. Combined with his excellent communication skills, I’m so glad I used him. I’m sure I could not have done this on my own. He seems extremely trustworthy, and I’ll be going back to him again next year.",
  },
  {
    name: "Tom MacDonald",
    detail: "3 reviews",
    ago: "a year ago",
    image: null as string | null,
    text: "Being a Quickbook’s pro advisor Tom knows his way around in quickbooks… quickly identified potential problems on my financial statements…luckily they were easy fixes…he can be trusted to do quality work…he has my recommendation…",
  },
  {
    name: "Brandon Fallis",
    detail: "4 reviews · 2 photos",
    ago: "a year ago",
    image: "https://www.bookkeepingconroe.com/images/google-review-profile-pics/brandon-fallis.png" as string | null,
    text: "Great company and great help with my bookkeeping. I met Tom at BlackRock Coffee and he immediately had a fix for my company books. Can’t thank him enough!",
  },
  {
    name: "Becky Chatham",
    detail: "Local Guide · 20 reviews",
    ago: "a year ago",
    image: "https://www.bookkeepingconroe.com/images/google-review-profile-pics/becky-chatham.png" as string | null,
    text: "did a great job helping me with my Quick books. Straightened out my books",
  },
];

function StarIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.539 1.118l-2.8-2.034a1 1 0 0 0-1.176 0l-2.8 2.034c-.783.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.719c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 0 0 .95-.69l1.07-3.292Z" />
    </svg>
  );
}

// Inline so the review cards never depend on an external image host.
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="Google" className="h-4 w-4">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function ReviewCard({
  name,
  detail,
  ago,
  text,
  image,
  visible,
  index,
}: (typeof REVIEWS)[number] & { visible: boolean; index: number }) {
  return (
    <div
      className="proposal-review-card flex flex-col rounded-xl border bg-white px-4 py-3 shadow-sm transition-all duration-500 ease-out"
      data-theme="light"
      style={{
        borderColor: "#cbd5e1",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transitionDelay: visible ? `${index * 80}ms` : "0ms",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0.5" style={{ color: "#f4b422" }}>
          {[0, 1, 2, 3, 4].map((i) => <StarIcon key={i} />)}
        </div>
        <GoogleIcon />
      </div>
      <p className="mt-2 flex-1 text-xs leading-5 text-slate-600 line-clamp-4">{text}</p>
      <div className="mt-2 flex items-center gap-2 border-t pt-2" style={{ borderColor: "#f1f5f9" }}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={name}
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600"
          >
            {name.charAt(0)}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-900">{name}</p>
          <p className="text-[0.65rem] text-slate-400">{detail} · {ago}</p>
        </div>
      </div>
    </div>
  );
}

export function ProposalReviewsSection({
  brandName,
  animate = false,
}: {
  brandName: string;
  animate?: boolean;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!animate);

  useEffect(() => {
    if (!animate) return;
    const el = gridRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [animate]);

  return (
    <div className="mt-16 pt-14">
      <p
        className="text-center text-xs font-semibold uppercase tracking-[0.16em]"
        style={{ color: "color-mix(in srgb, var(--proposal-ink, var(--theme-dark, #17324d)) 65%, transparent)" }}
      >
        {brandName} Reviews
      </p>
      <h2 className="mt-2 text-center text-2xl font-semibold md:text-3xl" style={{ color: "var(--proposal-ink, var(--theme-dark, #17324d))" }}>
        What Our Clients Are Saying
      </h2>
      <p className="mx-auto mt-3 mb-8 max-w-2xl text-center text-sm text-slate-600 md:text-base">
        Don&apos;t take our word for it — here&apos;s what real clients say about working with {brandName}.
      </p>
      <div
        ref={gridRef}
        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:[&>:last-child:nth-child(3n+1)]:col-start-2"
      >
        {REVIEWS.map((r, i) => (
          <ReviewCard key={r.name} {...r} visible={visible} index={i} />
        ))}
      </div>
    </div>
  );
}
