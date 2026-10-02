"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { track } from "@vercel/analytics";
import { useTranslations } from "next-intl";

/**
 * The landing-page explainer video.
 *
 * Built as a FACADE: on page load this renders nothing but a poster image and a
 * play button, so the 18 MB of video costs a visitor who never presses play
 * exactly zero bytes. The <video> element is created on the first click and
 * never before, which also keeps the element out of the initial layout and
 * therefore out of LCP and CLS.
 *
 * No autoplay, muted or otherwise. A video that starts talking at someone is
 * the single most reliable way to lose a visitor on a B2B landing page, and
 * muted autoplay just burns bandwidth on a video nobody is watching.
 */

const BASE = "/videos/landing";

/** Below this width the 720p encode is served instead of the 1080p one. */
const SMALL_VIEWPORT = 768;

/** Dispatched by the hero link to scroll here and begin playback. */
export const PLAY_EVENT = "shiftfy:play-explainer";

export interface ExplainerVideoProps {
  /** Where both CTAs point. Passed in so it stays identical to the hero's. */
  ctaHref: string;
  /** True when a WebM encode was kept (it is only kept if smaller than MP4). */
  hasWebm?: boolean;
}

export function ExplainerVideo({
  ctaHref,
  hasWebm = false,
}: ExplainerVideoProps) {
  const t = useTranslations("landing");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const headingId = useId();

  const [mounted, setMounted] = useState(false);
  const [ended, setEnded] = useState(false);

  /**
   * Progress milestones already reported.
   *
   * A ref, not state: firing an event must never cause a render, and seeking
   * backwards must not re-report a milestone that was already counted.
   */
  const reported = useRef<Set<number>>(new Set());

  /** Chosen once, when the element is created — not re-evaluated on resize. */
  const [smallViewport, setSmallViewport] = useState(false);

  const start = useCallback(() => {
    setSmallViewport(
      typeof window !== "undefined" && window.innerWidth <= SMALL_VIEWPORT,
    );
    setMounted(true);
    track("video_play");
  }, []);

  /**
   * The hero link asks for playback.
   *
   * A custom event rather than watching the hash: landing on /#erklaervideo
   * from a shared link should scroll there, not start talking at someone who
   * did not press anything. Only the explicit click plays.
   */
  useEffect(() => {
    const onRequest = () => {
      if (!mounted) start();
      else void videoRef.current?.play().catch(() => {});
    };
    window.addEventListener(PLAY_EVENT, onRequest);
    return () => window.removeEventListener(PLAY_EVENT, onRequest);
  }, [mounted, start]);

  /**
   * Play as soon as the element exists.
   *
   * With sound: the click that mounted it is a user gesture, so autoplay
   * policies permit audio here. A silent start would look broken.
   */
  useEffect(() => {
    if (!mounted) return;
    const el = videoRef.current;
    if (!el) return;
    void el.play().catch(() => {
      // Blocked anyway (rare, e.g. a strict enterprise policy). The native
      // controls are visible, so the viewer can simply press play.
    });
  }, [mounted]);

  /** Quarter-point progress, reported once each. */
  const onTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    const pct = (el.currentTime / el.duration) * 100;
    for (const milestone of [25, 50, 75]) {
      if (pct >= milestone && !reported.current.has(milestone)) {
        reported.current.add(milestone);
        track("video_progress", { percent: milestone });
      }
    }
  }, []);

  const onEnded = useCallback(() => {
    setEnded(true);
    track("video_complete");
  }, []);

  const replay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    setEnded(false);
    reported.current.clear();
    el.currentTime = 0;
    void el.play().catch(() => {});
  }, []);

  /**
   * Pause when scrolled away, but never resume.
   *
   * Someone who scrolls past a playing video has stopped watching it; audio
   * continuing from off-screen is the behaviour people reach for the tab close
   * button over. Resuming automatically would be the same mistake inverted --
   * they get to decide when it starts again.
   */
  useEffect(() => {
    if (!mounted) return;
    const frame = frameRef.current;
    if (!frame || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) videoRef.current?.pause();
      },
      { threshold: 0.25 },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, [mounted]);

  return (
    <div
      ref={frameRef}
      className="relative mx-auto w-full max-w-[1100px] overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-xl shadow-emerald-100/50 dark:border-emerald-400/20 dark:bg-zinc-900 dark:shadow-emerald-950/30"
    >
      {/* 16:9 box reserved up front, so mounting the video shifts nothing. */}
      <div className="relative aspect-video w-full">
        {mounted ? (
          <video
            ref={videoRef}
            controls
            playsInline
            preload="metadata"
            poster={`${BASE}/poster-clean-1920.jpg`}
            onTimeUpdate={onTimeUpdate}
            onEnded={onEnded}
            className="h-full w-full bg-black"
            aria-describedby={headingId}
          >
            {hasWebm && (
              <source
                src={`${BASE}/shiftfy-erklaervideo-1080.webm`}
                type="video/webm"
              />
            )}
            <source
              src={
                smallViewport
                  ? `${BASE}/shiftfy-erklaervideo-720.mp4`
                  : `${BASE}/shiftfy-erklaervideo-1080.mp4`
              }
              type="video/mp4"
            />
            {/*
             * Not `default`: subtitles stay off until asked for, which is what
             * a hearing viewer expects, while the native controls expose them
             * one tap away for everyone else (WCAG 1.2.2 / BFSG).
             */}
            <track
              kind="subtitles"
              srcLang="de"
              label="Deutsch"
              src={`${BASE}/shiftfy-erklaervideo.de.vtt`}
            />
          </video>
        ) : (
          <button
            type="button"
            onClick={start}
            aria-label={t("videoPlayAria")}
            className="group absolute inset-0 h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/50"
          >
            <picture>
              <source
                type="image/avif"
                srcSet={`${BASE}/poster-clean-960.avif 960w, ${BASE}/poster-clean-1920.avif 1920w`}
                sizes="(max-width: 1100px) 100vw, 1100px"
              />
              <source
                type="image/webp"
                srcSet={`${BASE}/poster-clean-960.webp 960w, ${BASE}/poster-clean-1920.webp 1920w`}
                sizes="(max-width: 1100px) 100vw, 1100px"
              />
              <img
                src={`${BASE}/poster-clean-1920.jpg`}
                alt=""
                width={1920}
                height={1080}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </picture>

            {/* Play affordance. Decorative: the button itself carries the label. */}
            <span
              aria-hidden
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/20 transition-colors group-hover:bg-black/30"
            >
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-600 shadow-lg transition-transform motion-safe:group-hover:scale-105 motion-reduce:transform-none">
                {/* Nudged right so the triangle looks centred, which it is not. */}
                <svg
                  viewBox="0 0 24 24"
                  className="ml-1 h-8 w-8 fill-white"
                  aria-hidden
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <span className="rounded-full bg-black/60 px-3 py-1 text-sm font-semibold text-white">
                {t("videoDuration")}
              </span>
            </span>
          </button>
        )}

        {/* End screen: the moment attention is highest and the video is over. */}
        {ended && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/80 px-6 text-center backdrop-blur-sm">
            <p
              id={headingId}
              className="max-w-md text-xl font-bold text-white sm:text-2xl"
            >
              {t("videoEndTitle")}
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <Link
                href={ctaHref}
                onClick={() =>
                  track("video_cta_click", { placement: "end_screen" })
                }
                className="flex w-full items-center justify-center rounded-full bg-brand-gradient px-8 py-4 text-base font-semibold text-white transition-all hover:shadow-xl hover:shadow-emerald-200 sm:w-auto"
              >
                {t("ctaButton")}
              </Link>
              <button
                type="button"
                onClick={replay}
                className="w-full rounded-full border border-white/30 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/50 sm:w-auto"
              >
                {t("videoReplay")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
