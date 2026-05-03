"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ClipboardIcon,
  ScaleIcon,
  UsersIcon,
  ClockIcon,
} from "@/components/icons";

interface Post {
  slug: string;
  title: string;
  excerpt: string;
  readTime: string;
  category: string;
  categoryKey: string;
  formattedDate: string;
}

interface Strings {
  readMore: string;
  readTime: string;
  filterAll: string;
  filterLabel: string;
  inlineCtaTitle: string;
  inlineCtaButton: string;
  startFree: string;
}

const CATEGORY_STYLES: Record<
  string,
  { bg: string; text: string; dot: string; iconBg: string }
> = {
  categoryPlanning: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    iconBg: "from-emerald-500 to-emerald-600",
  },
  categoryLaw: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    iconBg: "from-amber-500 to-amber-600",
  },
  categoryHR: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    dot: "bg-sky-500",
    iconBg: "from-sky-500 to-sky-600",
  },
  categoryTech: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    dot: "bg-violet-500",
    iconBg: "from-violet-500 to-violet-600",
  },
};

// Icon resolved client-side — avoids passing non-serializable functions from RSC
const CATEGORY_ICONS: Record<
  string,
  React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
  categoryPlanning: ClipboardIcon,
  categoryLaw: ScaleIcon,
  categoryHR: UsersIcon,
  categoryTech: ClockIcon,
};

function CategoryBadge({
  category,
  categoryKey,
}: {
  category: string;
  categoryKey: string;
}) {
  const style = CATEGORY_STYLES[categoryKey] ?? {
    bg: "bg-gray-50",
    text: "text-gray-700",
    dot: "bg-gray-400",
    iconBg: "from-gray-500 to-gray-600",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${style.bg} ${style.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {category}
    </span>
  );
}

const chevronPath = "M9 5l7 7-7 7";

export default function BlogContent({
  posts,
  strings,
}: {
  posts: Post[];
  strings: Strings;
}) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = Array.from(new Set(posts.map((p) => p.categoryKey)));
  const filtered = activeCategory
    ? posts.filter((p) => p.categoryKey === activeCategory)
    : posts;

  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <>
      {/* Category Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-8 -mt-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">
          {strings.filterLabel}
        </span>
        <button
          onClick={() => setActiveCategory(null)}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all border ${
            activeCategory === null
              ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500"
          }`}
        >
          {strings.filterAll} ({posts.length})
        </button>
        {categories.map((catKey) => {
          const style = CATEGORY_STYLES[catKey] ?? {
            bg: "bg-gray-50",
            text: "text-gray-700",
            dot: "bg-gray-400",
          };
          const count = posts.filter((p) => p.categoryKey === catKey).length;
          const catLabel =
            posts.find((p) => p.categoryKey === catKey)?.category ?? catKey;
          return (
            <button
              key={catKey}
              onClick={() =>
                setActiveCategory(activeCategory === catKey ? null : catKey)
              }
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all border ${
                activeCategory === catKey
                  ? `${style.bg} ${style.text} border-transparent`
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500"
              }`}
            >
              {catLabel} ({count})
            </button>
          );
        })}
      </div>

      {featured ? (
        <>
          {/* Featured Article */}
          <Link href={`/blog/${featured.slug}`} className="group block -mt-2">
            <article className="relative rounded-2xl border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden shadow-sm hover:shadow-xl hover:border-emerald-200/60 dark:hover:border-emerald-700/60 transition-all duration-300">
              <div className="grid md:grid-cols-5">
                {(() => {
                  const FeaturedIcon =
                    CATEGORY_ICONS[featured.categoryKey] ?? ClipboardIcon;
                  return (
                    <div
                      className={`md:col-span-2 bg-gradient-to-br ${CATEGORY_STYLES[featured.categoryKey]?.iconBg ?? "from-emerald-500 to-emerald-600"} flex items-center justify-center p-10 sm:p-14`}
                    >
                      <FeaturedIcon className="w-16 h-16 sm:w-20 sm:h-20 text-white drop-shadow-sm" />
                    </div>
                  );
                })()}
                <div className="md:col-span-3 p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <CategoryBadge
                      category={featured.category}
                      categoryKey={featured.categoryKey}
                    />
                    <span className="text-sm text-gray-400">
                      {featured.formattedDate}
                    </span>
                    <span className="text-sm text-gray-400">
                      · {featured.readTime} {strings.readTime}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 group-hover:text-emerald-600 transition-colors leading-snug">
                    {featured.title}
                  </h2>
                  <p className="mt-3 text-gray-600 leading-relaxed line-clamp-3">
                    {featured.excerpt}
                  </p>
                  <div className="mt-4 flex items-center gap-4">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 group-hover:gap-2.5 transition-all">
                      {strings.readMore}
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d={chevronPath}
                        />
                      </svg>
                    </span>
                    <Link
                      href="/register"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-semibold text-white bg-brand-gradient px-3.5 py-1.5 rounded-full hover:shadow-md transition-all"
                    >
                      {strings.startFree} →
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          </Link>

          {/* Articles Grid */}
          {rest.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
              {rest.map((post) => {
                const catStyle = CATEGORY_STYLES[post.categoryKey];
                const PostIcon =
                  CATEGORY_ICONS[post.categoryKey] ?? ClipboardIcon;
                return (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="group block"
                  >
                    <article className="h-full rounded-2xl border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden shadow-sm hover:shadow-xl hover:border-emerald-200/60 dark:hover:border-emerald-700/60 transition-all duration-300 flex flex-col">
                      <div className="h-40 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800/50 flex items-center justify-center group-hover:from-emerald-50 group-hover:to-emerald-100/50 dark:group-hover:from-emerald-950/50 dark:group-hover:to-emerald-900/30 transition-colors duration-300">
                        <div
                          className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${catStyle?.iconBg ?? "from-gray-500 to-gray-600"} flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg`}
                        >
                          <PostIcon className="w-8 h-8 text-white" />
                        </div>
                      </div>
                      <div className="p-5 sm:p-6 flex flex-col flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <CategoryBadge
                            category={post.category}
                            categoryKey={post.categoryKey}
                          />
                          <span className="text-xs text-gray-400">
                            {post.formattedDate}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-emerald-600 transition-colors leading-snug">
                          {post.title}
                        </h3>
                        <p className="mt-2 text-sm text-gray-600 leading-relaxed line-clamp-3 flex-1">
                          {post.excerpt}
                        </p>
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                          <span className="text-xs text-gray-400">
                            {post.readTime} {strings.readTime}
                          </span>
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 group-hover:gap-2 transition-all">
                            {strings.readMore}
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d={chevronPath}
                              />
                            </svg>
                          </span>
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })}

              {/* Inline CTA card */}
              <Link href="/register" className="group block">
                <div className="h-full rounded-2xl border-2 border-dashed border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 flex flex-col items-center justify-center p-8 text-center hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all duration-300 min-h-[220px]">
                  <div className="w-12 h-12 rounded-full bg-brand-gradient flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-md">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <p className="font-bold text-gray-900 dark:text-white text-base mb-2">
                    {strings.inlineCtaTitle}
                  </p>
                  <span className="text-sm font-semibold text-emerald-600">
                    {strings.inlineCtaButton} →
                  </span>
                </div>
              </Link>
            </div>
          )}
        </>
      ) : (
        <p className="text-center text-gray-500 py-16">{strings.filterAll}</p>
      )}
    </>
  );
}
