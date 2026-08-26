"use client";

import { useEffect, useRef, useState } from "react";

const REVIEWS = [
  {
    name: "Chelsea Gronemeyer",
    detail: "1 review",
    ago: "8 months ago",
    image: "https://bookkeepingconroe.com/reviews/Chelsea-Gronemeyer.png",
    text: "Tom is very knowledgeable about bookkeeping and he is always willing to help out with any questions or concerns I may have. I really feel like he puts his clients first and I wouldn't want to work with anyone else.",
  },
  {
    name: "Giorgio Villani",
    detail: "5 reviews",
    ago: "a year ago",
    image: "https://bookkeepingconroe.com/reviews/giorgio-villani.png",
    text: "Tom's consultation made it clear how proper bookkeeping is key to financial planning and strategic decisions. He explained how accurate records improve cash flow forecasting, budgeting, and tax prep. His clear communication helped me understand how to use financial data for smarter business actions. Highly recommended!",
  },
  {
    name: "Geoff Lohnes",
    detail: "12 reviews",
    ago: "a year ago",
    image: "https://bookkeepingconroe.com/reviews/geoff-lohnes.png",
    text: "I've been working with Thomas lately, and I'm blown away by his vast knowledge of bookkeeping. Combined with his excellent communication skills, I'm so glad I used him. I'm sure I could not have done this on my own. He seems extremely trustworthy, and I'll be going back to him again next year.",
  },
  {
    name: "Brandon Fallis",
    detail: "4 reviews · 2 photos",
    ago: "a year ago",
    image: "https://bookkeepingconroe.com/reviews/brandon-fallis.png",
    text: "Great company and great help with my bookkeeping. I met Tom at BlackRock Coffee and he immediately had a fix for my company books. Can't thank him enough!",
  },
  {
    name: "Becky Chatham",
    detail: "Local Guide · 18 reviews",
    ago: "a year ago",
    image: "https://bookkeepingconroe.com/reviews/becky-chatham.png",
    text: "did a great job helping me with my Quick books. Straightened out my books.",
  },
  {
    name: "Dagny Yznaga",
    detail: "Local Guide",
    ago: "recently",
    image: "https://bookkeepingconroe.com/reviews/Dagny-Yznaga.png",
    text: "I met Tom through business and now he's become a friend. He has outstanding and up-to-date bookkeeping knowledge. He is a loyal and reliable professional who treats all his clients in the best possible way; with transparency, clarity and proper communication. I own a similar business and every time I get a Quickbooks client, I send them to Bookkeeping Conroe and they've never let me down. 100% recommended.",
  },
];

function StarIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.539 1.118l-2.8-2.034a1 1 0 0 0-1.176 0l-2.8 2.034c-.783.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.719c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 0 0 .95-.69l1.07-3.292Z" />
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
      className="flex flex-col rounded-xl border bg-white px-4 py-3 shadow-sm transition-all duration-500 ease-out"
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://bookkeepingconroe.com/Google_Favicon_2025.webp"
          alt="Google"
          width={16}
          height={16}
          className="h-4 w-4 object-contain"
        />
      </div>
      <p className="mt-2 flex-1 text-xs leading-5 text-slate-600 line-clamp-3">{text}</p>
      <div className="mt-2 flex items-center gap-2 border-t pt-2" style={{ borderColor: "#f1f5f9" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={name}
          width={28}
          height={28}
          className="h-7 w-7 shrink-0 rounded-full object-cover"
        />
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
    <div className="mt-16 border-t pt-14" style={{ borderColor: "#e2e8f0" }}>
      <p
        className="text-center text-xs font-semibold uppercase tracking-[0.16em]"
        style={{ color: "var(--brand-primary, #17324d)" }}
      >
        {brandName} Reviews
      </p>
      <h2 className="mt-2 text-center text-2xl font-semibold text-slate-900 md:text-3xl">
        What Our Clients Are Saying
      </h2>
      <p className="mx-auto mt-3 mb-8 max-w-2xl text-center text-sm text-slate-600 md:text-base">
        Don&apos;t take our word for it — here&apos;s what real clients say about working with {brandName}.
      </p>
      <div
        ref={gridRef}
        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {REVIEWS.map((r, i) => (
          <ReviewCard key={r.name} {...r} visible={visible} index={i} />
        ))}
      </div>
    </div>
  );
}
