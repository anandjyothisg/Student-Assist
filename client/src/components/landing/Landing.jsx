import React, { useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import { scrollToElement } from './scrollTo';
import { LandingNav } from './LandingNav';
import { Hero } from './Hero';
import { ProblemScene } from './ProblemScene';
import { MethodScene } from './MethodScene';
import { AnswerLab } from './AnswerLab';
import { Vantage } from './Vantage';
import { Closing, LandingFooter, UnderTheHood } from './Closing';
import { Stitch } from './Thread';
import { ThreadBand } from './ThreadBand';
import { CourseShelf } from './CourseShelf';
import { ClassPulse } from './ClassPulse';
import { useSmoothScroll } from './useSmoothScroll';

/*
 * The public landing page. One idea carries it: the citation thread.
 *   Hero      the thread is drawn: an answer tied to the line it came from
 *   Band      the thread at full width, drawn by the scroll through real sources
 *   Problem   the thread is cut: a fluent answer with nothing behind it
 *   Method    the thread runs through the pipeline that ties it
 *   Lab       the visitor pulls it, or watches it fail to find a source
 *   Pulse     what teachers see: the trend line is the thread
 *   Shelf     the six real courses the thread ties into
 *   Roles / Under the hood   supporting facts, as screens and numbers
 *   Close     the thread ties off on the call to action
 */
export default function Landing({ onStart }) {
  useSmoothScroll();
  /* In-page anchors scroll without touching the hash, which the app uses for routing. */
  const onClick = (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href.startsWith('#/')) return;
    const el = document.getElementById(href.slice(1));
    if (!el) return;
    e.preventDefault();
    scrollToElement(el);
    el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  };

  useEffect(() => {
    const prev = document.title;
    document.title = 'AuraStudy · Answers from your course materials, with sources';
    return () => { document.title = prev; };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="landing relative min-h-dvh bg-canvas text-fg" onClick={onClick}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:rounded-md focus:bg-fg focus:px-3 focus:py-2 focus:text-sm focus:text-canvas"
          style={{ zIndex: 'var(--z-toast)' }}
        >
          Skip to content
        </a>
        <LandingNav onStart={onStart} />
        <main id="main" className="relative">
          <Hero onStart={onStart} />
          <ThreadBand />
          <ProblemScene />
          <Stitch height={120} />
          <MethodScene />
          <Stitch height={96} />
          <AnswerLab />
          <ClassPulse />
          <CourseShelf />
          <Vantage />
          <UnderTheHood />
          <Closing onStart={onStart} />
        </main>
        <LandingFooter />
      </div>
    </MotionConfig>
  );
}
