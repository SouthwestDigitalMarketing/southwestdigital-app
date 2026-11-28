// Bookkeeping Conroe local SEO plan, from the Chris Palmer study.
// Source of truth for the plan: All Thing concepts/seo-strategy-chris-palmer.md
// and sops/sop-local-seo-calendar.md; listing state: bookkeepingconroe-web
// docs/nap-consistency.md. Update the status here when an item moves.

export type SeoPlanStatus = "done" | "waiting" | "todo" | "check" | "ongoing";

export type SeoPlanItem = {
  title: string;
  status: SeoPlanStatus;
  what: string;
  next?: string;
  blocker?: string;
};

export type SeoPlanSection = { title: string; items: SeoPlanItem[] };

export const SEO_PLAN_AS_OF = "2026-11-28";

export const SEO_PLAN_STATUS_LABEL: Record<SeoPlanStatus, string> = {
  done: "Done",
  waiting: "Waiting",
  todo: "To do",
  check: "Needs a check",
  ongoing: "Ongoing",
};

export const SEO_PLAN: SeoPlanSection[] = [
  {
    title: "Website",
    items: [
      {
        title: "Stop review gating on /review",
        status: "done",
        what: "The review page only sent 5-star answers to Google. That breaks Google's rules and gets reviews filtered. Every visitor now sees the Google review link.",
        next: "Nothing. Shipped in bookkeepingconroe-web PR #78 (2026-11-18).",
      },
      {
        title: "Test each town page against Conroe",
        status: "done",
        what: "Palmer's rule: if two towns show the same search results, one page is enough. Every town showed different results, so all 5 town pages stay.",
        next: "Nothing. Tested 2026-11-18 and 2026-11-19 (DataForSEO).",
      },
      {
        title: "Strengthen the 5 town pages",
        status: "done",
        what: "County, ZIP codes and neighborhoods inside each town page, plus links to them that say \"Bookkeeping in <town>\".",
        next: "Nothing. PR #81 (2026-11-18).",
      },
      {
        title: "No FAQ headings on money pages",
        status: "done",
        what: "Palmer moved question headings off sales pages. Town pages and the homepage now use statements; FAQ schema removed there.",
        next: "Nothing. PR #87 (2026-11-19).",
      },
      {
        title: "Schema: profile link, listings, Thomas",
        status: "done",
        what: "The page code now links the Google profile (static map link), Manta, ChamberofCommerce.com and Pinterest, and describes Thomas as the founder.",
        next: "Add Yelp and Bing (both live since 2026-11-26/27) to sameAs on the homepage; Apple when approved.",
      },
      {
        title: "Homepage H1: bookkeeper, Conroe",
        status: "done",
        what: "The homepage's main heading lacked both words. It now reads \"Bookkeeper in Conroe, TX\".",
        next: "Nothing. PR #88 (2026-11-20).",
      },
      {
        title: "Rental words on real estate page",
        status: "done",
        what: "We were missing from the map pack for \"rental property bookkeeping conroe tx\". The page title and body now use that phrase.",
        next: "Watch the next map scan for that term.",
      },
      {
        title: "Descriptive link words",
        status: "done",
        what: "Links say what the page is (\"QuickBooks cleanup in Conroe\"), not \"Learn more\". Footer has a Bookkeeping column.",
        next: "Nothing. PRs #81 and #87.",
      },
      {
        title: "Veteran-owned line on the site",
        status: "done",
        what: "Backs the veteran-owned attribute on the Google profile.",
        next: "Nothing. PR #87.",
      },
      {
        title: "Hide junk pages from Google",
        status: "done",
        what: "Style guide and under-development pages are noindex; /studio and /discovery are blocked in robots.txt.",
        next: "Recheck in the 90-day index review.",
      },
      {
        title: "Answer page: bookkeeping cost",
        status: "done",
        what: "Palmer's top answer page. Live at /bookkeeping-cost.",
        next: "More answer pages go in one a month (see Every month).",
      },
      {
        title: "Benchmark money pages vs top 5",
        status: "todo",
        what: "Compare word count, headings and key terms on each service page with the top 3-5 results for its search. The homepage was checked 2026-11-19 and already wins.",
        next: "Do the 6 service pages, real estate and short-term rental.",
      },
      {
        title: "Stop form spam",
        status: "done",
        what: "Cloudflare human check, fill-time and content checks on every website form (bookkeepingconroe-web PRs #94-#96, 2026-11-25). Bot fills still arrive, marked \"[Possible spam]\" in the subject.",
        next: "Glance at [Possible spam] mail now and then for a real person caught by mistake.",
      },
    ],
  },
  {
    title: "Google Business Profile",
    items: [
      {
        title: "Posts every other day",
        status: "ongoing",
        what: "One post per money page, each linking to that page, scheduled in Google with the Schedule switch.",
        next: "Scheduled through 2026-12-09. The next batch (4 posts: payroll, a town page, real estate, CFO advisory) is not written yet; schedule it before 2026-12-05.",
      },
      {
        title: "Categories, services, products",
        status: "check",
        what: "One main category matching the homepage. Services = only ones with a site page; remove ones Google added. Products named \"service + town\", each linking its page. Checked 2026-11-28 from Google's public data: one category, \"Bookkeeping service\", no extras (good).",
        next: "Services and products only show in the profile dashboard: open it and confirm what was saved on 2026-11-18.",
        blocker: "Needs the profile dashboard in a browser signed in to Google.",
      },
      {
        title: "Trim the service area",
        status: "check",
        what: "Houston, Huntsville and New Waverly are listed but have no pages and sit 25+ miles out. Keep the county and the towns we have pages for.",
        next: "Open the profile and check; remove the three if still there.",
        blocker: "Service area only shows in the profile dashboard.",
      },
      {
        title: "Replace stock and wrong-office photos",
        status: "todo",
        what: "The profile has a stock-looking high-five photo and an office photo that is not our office (14 photos in all, 2026-11-28). Six real stills from our videos are ready on Nostromo (listing-stills-2026-11-21).",
        next: "Remove the two bad photos; upload the real stills.",
      },
      {
        title: "New phone photos at the office",
        status: "todo",
        what: "At least 3 each: outside, inside, Tom at work, Tom. Real phone photos, unique file names, no AI images. Repeat every 90 days.",
        blocker: "Needs Tom at the office with his phone.",
      },
      {
        title: "No UTM tag on the website link",
        status: "done",
        what: "Palmer says tracking tags on the profile link hurt. Ours is the plain URL (checked 2026-11-28).",
      },
    ],
  },
  {
    title: "Listings",
    items: [
      {
        title: "Manta, chambers",
        status: "done",
        what: "Live with name, address and phone copied word for word from Google.",
      },
      {
        title: "Apple Maps (Apple Business)",
        status: "waiting",
        what: "Organization \"Lochside LLC\" sent for Apple's review 2026-11-20 (up to 5 business days). No approval email by 2026-11-28, past that window.",
        next: "Check the status at business.apple.com; once approved, add the Beach Walk location.",
        blocker: "Apple's review.",
      },
      {
        title: "Bing Places",
        status: "done",
        what: "Live: Bing emailed \"Your business is live on Bing\" on 2026-11-27.",
        next: "Add it to schema sameAs.",
      },
      {
        title: "Yelp",
        status: "done",
        what: "Live: Yelp reported page visits from 2026-11-19 and more activity on 2026-11-26.",
        next: "Add it to schema sameAs. Ignore Yelp's paid-ads pitches.",
      },
      {
        title: "Data Axle",
        status: "waiting",
        what: "No self-serve add; asked by email 2026-11-16. No reply by 2026-11-28.",
        next: "Follow up around 2026-11-30 if not added.",
      },
      {
        title: "BBB, Hotfrog, Foursquare",
        status: "waiting",
        what: "Submitted 2026-11-16, pending their review; no email from any of them by 2026-11-28. Foursquare claim ($20) skipped.",
        next: "Check each is live.",
      },
      {
        title: "Other data aggregators",
        status: "todo",
        what: "Neustar/Localeze, Dun & Bradstreet, Acxiom, Experian (free ones only). They feed MapQuest and others.",
      },
      {
        title: "Copy the winners' listings",
        status: "todo",
        what: "Search each top-3 map competitor's name and street address in quotes. The directories they share are the ones to join.",
        next: "Run once; add the 2-3 niche listings we lack.",
      },
      {
        title: "Bing Webmaster Tools + sitemap",
        status: "todo",
        what: "Free. Bing's version of Search Console.",
      },
    ],
  },
  {
    title: "Reviews",
    items: [
      {
        title: "Steady review asks",
        status: "todo",
        what: "A few a month, never a burst. Clients say in their own words which service and which town. From their own phone. Still 10 Google reviews on 2026-11-28; no asks sent yet.",
        next: "Personal ask after each finished month-end report.",
        blocker: "Each ask needs Tom's yes before it is sent.",
      },
      {
        title: "Reply to reviews within 24h",
        status: "ongoing",
        what: "Thank them and name the service in plain words.",
      },
    ],
  },
  {
    title: "Every month",
    items: [
      {
        title: "Search Console 5-20 loop",
        status: "todo",
        what: "Find searches where a page sits at 5-20; put the exact phrase in a heading or sentence; wait 14-30 days. Then 20-60. Property set up 2026-11-18.",
        next: "First run in the first week of December, once data has built up.",
      },
      {
        title: "Internal-link check",
        status: "todo",
        what: "Links > Internal: money pages should be the most linked; \"Home\" and \"Learn more\" should not be top link words.",
        next: "First run in the first week of December.",
      },
      {
        title: "One answer page a month",
        status: "ongoing",
        what: "One question per page (what a bookkeeper does, bookkeeper vs CPA, QuickBooks cleanup, rental-owner setup). Never per city. Each links up to its service page.",
      },
      {
        title: "Map grid scan every 2 weeks",
        status: "ongoing",
        what: "Baseline 2026-11-21: top 3 in 63% of points for \"bookkeeper\"; we drop off about 8 miles south (The Woodlands, Spring). Goal: push the south edge.",
        next: "The weekly scan on 2026-11-23 failed (DataForSEO \"payment required\", 402); balance is $54.67 on 2026-11-28. Check the 2026-11-30 weekly scan ran.",
      },
      {
        title: "Scoreboard: calls, form fills",
        status: "todo",
        what: "Palmer's scorecard is calls, form fills and reviews, not rank. One table for Tom each month.",
        next: "First table in the first week of December. Spam is now flagged, so real form fills can be counted.",
      },
      {
        title: "Microsoft Clarity heatmaps",
        status: "todo",
        what: "Free. Shows where visitors click and stop, and whether phone and form are seen above the fold. Not on bookkeepingconroe.com yet (2026-11-28); the Clarity account has a \"Proposals\" project only.",
      },
    ],
  },
];

// Numbers SWapp cannot read yet; update with the date when they change.
export const SEO_SCORE = {
  googleReviews: { value: 10, asOf: "2026-11-28", note: "on the Google profile; 2 are from family" },
  realFormLeads: { value: 0, of: 48, from: "2026-11-19", to: "2026-11-28", note: "spam, sales pitches or our own tests" },
};

/** Words used for the top-3 share on the Overview: Palmer's broad term, searched from the office. */
export const SEO_GOAL_KEYWORD = "bookkeeper";
