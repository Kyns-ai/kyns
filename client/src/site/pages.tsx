import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  ArrowRight,
  BookOpen,
  Database,
  ExternalLink,
  ImageIcon,
  Lock,
  Mail,
  Menu,
  MessageSquare,
  Scale,
  Shield,
  Sparkles,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import type { FAQCategory, LegalPageKey, PhilosophyPillar, SiteCard, SiteLink } from './content';
import {
  aboutContent,
  contactContent,
  faqCategories,
  footerColumns,
  homeContent,
  legalPages,
  navigationLinks,
  pageMeta,
  philosophyIntro,
  philosophyPillars,
  philosophySummary,
  siteConfig,
  toolResponsibilityQuote,
  toolResponsibilityLines,
  transparencyContent,
  libraryQuote,
} from './content';
import './site.css';

const NAV_BUTTON_LABEL = 'Acessar KYNS';
const MOBILE_MENU_OPEN_LABEL = 'Abrir menu';
const MOBILE_MENU_CLOSE_LABEL = 'Fechar menu';
const PHILOSOPHY_SUMMARY_LABEL = 'Síntese';

function upsertMetaTag(
  selector: string,
  attributeName: 'name' | 'property',
  attributeValue: string,
  content: string,
) {
  let element = document.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attributeName, attributeValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function useSiteMeta({ title, description, path }: (typeof pageMeta)[keyof typeof pageMeta]) {
  useEffect(() => {
    document.title = title;
    upsertMetaTag('meta[name="description"]', 'name', 'description', description);
    upsertMetaTag('meta[name="robots"]', 'name', 'robots', 'index, follow');
    upsertMetaTag('meta[name="rating"]', 'name', 'rating', 'adult');
    upsertMetaTag('meta[name="theme-color"]', 'name', 'theme-color', '#FAFAF8');
    upsertMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', 'KYNS');
    upsertMetaTag('meta[property="og:type"]', 'property', 'og:type', 'website');
    upsertMetaTag('meta[property="og:title"]', 'property', 'og:title', title);
    upsertMetaTag('meta[property="og:description"]', 'property', 'og:description', description);
    upsertMetaTag(
      'meta[property="og:url"]',
      'property',
      'og:url',
      new URL(path, siteConfig.rootUrl).toString(),
    );
  }, [description, path, title]);
}

function SiteLinkRenderer({
  item,
  className,
  onNavigate,
}: {
  item: SiteLink;
  className?: string;
  onNavigate?: () => void;
}) {
  if (item.external) {
    return (
      <a
        className={className}
        href={item.href}
        onClick={onNavigate}
        rel="noreferrer"
        target="_blank"
      >
        {item.label}
      </a>
    );
  }

  return (
    <Link className={className} onClick={onNavigate} to={item.href}>
      {item.label}
    </Link>
  );
}

function Reveal({ children, className }: PropsWithChildren<{ className?: string }>) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          return;
        }
        setVisible(true);
        observer.disconnect();
      },
      { threshold: 0.12 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={`site-reveal ${visible ? 'site-reveal--visible' : ''} ${className ?? ''}`}>{children}</div>;
}

function MediaPanel({
  label,
  title,
  description,
  src,
  type,
}: {
  label: string;
  title: string;
  description: string;
  src: string;
  type: 'image' | 'video';
}) {
  return (
    <div className="site-placeholder relative overflow-hidden">
      {type === 'video' ? (
        <video
          autoPlay={true}
          className="h-[420px] w-full object-cover md:h-[560px]"
          loop={true}
          muted={true}
          playsInline={true}
          src={src}
        />
      ) : (
        <img
          alt={title}
          className="h-[420px] w-full object-cover md:h-[520px]"
          src={src}
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/14 via-transparent to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
        <div className="max-w-2xl">
          <span className="site-media-chip border-white/12 bg-black/22 text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
            {label}
          </span>
          <h3 className="site-display site-media-title mt-5 text-3xl md:text-4xl">
            {title}
          </h3>
          <p className="site-media-description mt-4 max-w-xl text-base leading-8">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={`max-w-3xl ${className ?? ''}`}>
      {eyebrow ? <span className="site-eyebrow">{eyebrow}</span> : null}
      <h2 className="site-display mt-6 text-[clamp(2.4rem,5vw,4.5rem)] text-[#111111]">{title}</h2>
      {description ? <p className="site-prose mt-6 max-w-2xl">{description}</p> : null}
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="kyns-shell py-16 md:py-20">
        <div className="grid gap-10 border-b border-black/6 pb-12 md:grid-cols-[1.15fr,0.85fr,0.85fr,0.85fr]">
          <div className="max-w-md">
            <span className="site-eyebrow">KYNS</span>
            <h2 className="site-display mt-5 text-4xl text-[#111111]">{siteConfig.tagline}</h2>
            <p className="mt-5 text-base leading-8 text-[#666666]">{siteConfig.disclaimer}</p>
          </div>
          {footerColumns.map((column) => (
            <div key={column.title}>
              <h3 className="font-mono text-xs uppercase tracking-[0.22em] text-[#8d8d8d]">{column.title}</h3>
              <div className="mt-5 flex flex-col gap-3">
                {column.links.map((item) => (
                  <div key={item.href}>
                    <SiteLinkRenderer
                      item={item}
                      className="site-link inline-flex items-center gap-2 text-base text-[#111111]"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4 pt-8 text-sm text-[#7a7a7a] md:flex-row md:items-center md:justify-between">
          <p>{siteConfig.footerTagline}</p>
          <p>{siteConfig.copyright}</p>
        </div>
      </div>
    </footer>
  );
}

export function SiteLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <div className="kyns-site">
      <header className="site-nav-panel sticky top-0 z-50 border-b border-black/6">
        <div className="kyns-shell flex h-20 items-center justify-between gap-6">
          <Link className="site-link flex items-center gap-3" to="/">
            <div className="flex size-11 items-center justify-center overflow-hidden rounded-full border border-[#c8a86e]/35 bg-black shadow-sm">
              <img
                alt="KYNS logo"
                className="h-full w-full object-cover"
                src="/assets/kyns-logo-mark.png"
              />
            </div>
            <div>
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-[#8d8d8d]">κυνικός</div>
              <div className="text-base font-semibold text-[#111111]">KYNS</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {navigationLinks.map((item) => (
              <NavLink
                key={item.href}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${isActive ? 'text-[#111111]' : 'text-[#666666] hover:text-[#b89555]'}`
                }
                to={item.href}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:block">
            <a className="site-button text-sm" href={siteConfig.accessUrl} rel="noreferrer" target="_blank">
              {NAV_BUTTON_LABEL}
              <ArrowRight className="size-4" />
            </a>
          </div>

          <button
            aria-expanded={menuOpen}
            aria-label={menuOpen ? MOBILE_MENU_CLOSE_LABEL : MOBILE_MENU_OPEN_LABEL}
            className="inline-flex size-11 items-center justify-center rounded-full border border-black/8 bg-white/80 text-[#111111] shadow-sm md:hidden"
            onClick={() => setMenuOpen((value) => !value)}
            type="button"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {menuOpen ? (
          <div className="border-t border-black/6 md:hidden">
            <div className="kyns-shell flex flex-col gap-3 py-5">
              {navigationLinks.map((item) => (
                <NavLink
                  key={item.href}
                  className={({ isActive }) =>
                    `rounded-2xl border px-4 py-3 text-base ${isActive ? 'border-[#c8a86e]/40 bg-white text-[#111111]' : 'border-black/6 bg-white/70 text-[#666666]'}`
                  }
                  onClick={() => setMenuOpen(false)}
                  to={item.href}
                >
                  {item.label}
                </NavLink>
              ))}
              <a
                className="site-button mt-2 text-sm"
                href={siteConfig.accessUrl}
                rel="noreferrer"
                target="_blank"
              >
                {NAV_BUTTON_LABEL}
                <ArrowRight className="size-4" />
              </a>
            </div>
          </div>
        ) : null}
      </header>

      <main>
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}

function HomeCardGrid({
  cards,
  icons,
}: {
  cards: readonly SiteCard[];
  icons: readonly LucideIcon[];
}) {
  return (
    <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, index) => {
        const Icon = icons[index];
        return (
          <Reveal key={card.title}>
            <article className="site-card h-full p-6 md:p-7">
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#8d8d8d]">
                  {card.eyebrow}
                </span>
                <Icon className="size-5 text-[#b89555]" />
              </div>
              <h3 className="mt-6 text-2xl font-semibold text-[#111111]">{card.title}</h3>
              <p className="mt-4 text-[15px] leading-8 text-[#666666]">{card.description}</p>
            </article>
          </Reveal>
        );
      })}
    </div>
  );
}

function FAQCategorySection({ category }: { category: FAQCategory }) {
  return (
    <section className="site-section">
      <div className="kyns-shell">
        <SectionIntro title={category.title} />
        <div className="mt-10 grid gap-4">
          {category.items.map((item) => (
            <Reveal key={item.question}>
              <details className="site-accordion group p-0">
                <summary className="flex items-center justify-between gap-4 px-6 py-5 text-left md:px-7">
                  <span className="text-lg font-semibold text-[#111111]">{item.question}</span>
                  <span className="font-mono text-xs uppercase tracking-[0.18em] text-[#8d8d8d] group-open:text-[#b89555]">
                    abrir
                  </span>
                </summary>
                <div className="border-t border-black/6 px-6 py-5 md:px-7">
                  <p className="text-base leading-8 text-[#666666]">{item.answer}</p>
                </div>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function MarkdownLink({
  href,
  children,
}: PropsWithChildren<{
  href?: string;
}>) {
  if (!href) {
    return <span>{children}</span>;
  }

  const external = href.startsWith('http');
  return (
    <a
      className="site-link underline decoration-[#c8a86e]/35 underline-offset-4"
      href={href}
      rel={external ? 'noreferrer' : undefined}
      target={external ? '_blank' : undefined}
    >
      {children}
    </a>
  );
}

function LegalMarkdownPage({ pageKey }: { pageKey: LegalPageKey }) {
  const page = legalPages[pageKey];
  useSiteMeta(page.meta);

  return (
    <section className="site-section">
      <div className="kyns-shell">
        <Reveal>
          <SectionIntro eyebrow={page.eyebrow} title={page.title} description={page.updatedLabel} />
        </Reveal>
        <div className="mt-10">
          <article className="site-card px-6 py-8 md:px-10 md:py-12">
            <div className="site-markdown">
              <ReactMarkdown
                components={{
                  a: ({ href, children }) => <MarkdownLink href={href}>{children}</MarkdownLink>,
                }}
              >
                {page.markdown}
              </ReactMarkdown>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function PhilosophySection({ pillar }: { pillar: PhilosophyPillar }) {
  return (
    <Reveal>
      <article className="site-card p-8 md:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">
          <div className="max-w-md">
            <span className="site-eyebrow">
              {pillar.numeral} · {pillar.philosopher}
            </span>
            <p className="mt-4 font-mono text-xs uppercase tracking-[0.18em] text-[#8d8d8d]">
              {pillar.years}
            </p>
            <blockquote className="site-display mt-8 text-[clamp(2rem,4vw,3.4rem)] text-[#111111]">
              {pillar.quote}
            </blockquote>
          </div>
          <div className="max-w-2xl">
            {pillar.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-[1.02rem] leading-8 text-[#666666]">
                {paragraph}
              </p>
            ))}
            <div className="mt-8 rounded-[24px] border border-[#c8a86e]/30 bg-[#f5eee1] px-5 py-4 text-base font-medium text-[#111111]">
              {pillar.principle}
            </div>
          </div>
        </div>
      </article>
    </Reveal>
  );
}

export function SiteHomePage() {
  useSiteMeta(pageMeta.home);

  return (
    <>
      <section className="site-section overflow-hidden pt-16 md:pt-24">
        <div className="kyns-shell grid gap-12 lg:grid-cols-[1.02fr,0.98fr] lg:items-center">
          <Reveal>
            <div className="max-w-2xl">
              <span className="site-eyebrow">{homeContent.hero.eyebrow}</span>
              <h1 className="site-display mt-7 text-[clamp(3rem,8vw,6rem)] text-[#111111]">
                {homeContent.hero.title}
              </h1>
              <p className="site-prose mt-7 max-w-xl">{homeContent.hero.description}</p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
                <a className="site-button text-sm" href={siteConfig.accessUrl} rel="noreferrer" target="_blank">
                  {homeContent.hero.primaryCta}
                  <ArrowRight className="size-4" />
                </a>
                <Link className="site-button-secondary text-sm" to="/philosophy">
                  {homeContent.hero.secondaryCta}
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <span className="site-eyebrow">{siteConfig.heroBadge}</span>
                <p className="text-sm leading-7 text-[#7a7a7a]">{homeContent.hero.supportText}</p>
              </div>
            </div>
          </Reveal>

          <Reveal>
            <MediaPanel
              description="Um manifesto visual sobre liberdade intelectual, privacidade e o direito de buscar conhecimento sem pedir permissão."
              label="MANIFESTO"
              src="/assets/kyns-hero-video.mp4"
              title="A lanterna está acesa."
              type="video"
            />
          </Reveal>
        </div>
      </section>

      <section className="site-section">
        <div className="kyns-shell min-h-[78vh]">
          <Reveal>
            <div className="flex min-h-[68vh] flex-col justify-center">
              <span className="site-eyebrow">{homeContent.toolSection.eyebrow}</span>
              <div className="mt-8 space-y-4 md:space-y-5">
                {toolResponsibilityLines.map((line, index) => {
                  const highlight = index === toolResponsibilityLines.length - 1;
                  return (
                    <p
                      key={line}
                      className={`site-display text-[clamp(2.25rem,5.8vw,5.6rem)] ${
                        highlight ? 'text-[#c8a86e]' : 'text-[#111111]'
                      }`}
                    >
                      {line}
                    </p>
                  );
                })}
              </div>
              <p className="mt-8 max-w-2xl text-lg leading-8 text-[#666666]">
                {homeContent.toolSection.description}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="site-section">
        <div className="kyns-shell grid gap-10 lg:grid-cols-[0.95fr,1.05fr] lg:items-center">
          <Reveal>
            <MediaPanel
              description="Uma biblioteca guarda inclusive o conhecimento perigoso. O problema nunca esteve nas estantes, mas no uso que cada pessoa faz do que encontra nelas."
              label="BIBLIOTECA"
              src="/assets/kyns-library-video.mp4"
              title="Toda biblioteca séria contém mais do que conforto."
              type="video"
            />
          </Reveal>
          <Reveal>
            <SectionIntro
              eyebrow={homeContent.librarySection.eyebrow}
              description={homeContent.librarySection.description}
              title={homeContent.librarySection.title}
            />
            <p className="mt-8 text-[1.02rem] leading-8 text-[#666666]">{libraryQuote}</p>
          </Reveal>
        </div>
      </section>

      <section className="site-section">
        <div className="kyns-shell">
          <SectionIntro
            eyebrow="PRIVACIDADE"
            description="Privacidade, aqui, não depende de confiança cega. Ela depende de reduzir ao mínimo o que pode virar acervo centralizado."
            title="Privacidade por arquitetura."
          />
          <HomeCardGrid cards={homeContent.privacyCards} icons={[Database, Lock, Shield]} />
        </div>
      </section>

      <section className="site-section">
        <div className="kyns-shell">
          <SectionIntro
            eyebrow="O QUE O KYNS FAZ"
            description="Chat, imagem, personagens e privacidade real a partir de uma posição explícita sobre liberdade intelectual, conhecimento e responsabilidade."
            title="O que o KYNS faz."
          />
          <HomeCardGrid
            cards={homeContent.whatKynsDoes}
            icons={[MessageSquare, ImageIcon, Sparkles, Shield]}
          />
        </div>
      </section>

      <section className="site-section">
        <div className="kyns-shell grid gap-10 lg:grid-cols-[0.92fr,1.08fr] lg:items-center">
          <Reveal>
            <SectionIntro
              eyebrow={homeContent.diogenesSection.eyebrow}
              description={homeContent.diogenesSection.description}
              title={homeContent.diogenesSection.title}
            />
          </Reveal>
          <Reveal>
            <MediaPanel
              description="Diógenes diante de Alexandre, recusando poder quando ele tenta ocupar o lugar da verdade. É dessa recusa que o KYNS herda seu nome."
              label="DIÓGENES"
              src="/assets/kyns-diogenes-video.mp4"
              title="Sai da frente do meu sol."
              type="video"
            />
          </Reveal>
        </div>
      </section>

      <section className="site-section pb-20">
        <div className="kyns-shell">
          <Reveal>
            <div className="site-card overflow-hidden p-8 md:p-12">
              <span className="site-eyebrow">{homeContent.finalCta.eyebrow}</span>
              <div className="mt-6 grid gap-10 lg:grid-cols-[1fr,0.7fr] lg:items-end">
                <div>
                  <h2 className="site-display text-[clamp(2.7rem,6vw,5.2rem)] text-[#111111]">
                    {homeContent.finalCta.title}
                  </h2>
                  <p className="site-prose mt-6 max-w-2xl">{homeContent.finalCta.description}</p>
                  <div className="mt-6">
                    <span className="site-eyebrow">{homeContent.finalCta.badge}</span>
                  </div>
                </div>
                <div className="flex justify-start lg:justify-end">
                  <a className="site-button text-sm" href={siteConfig.accessUrl} rel="noreferrer" target="_blank">
                    {homeContent.finalCta.button}
                    <ArrowRight className="size-4" />
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

export function SiteAboutPage() {
  useSiteMeta(pageMeta.about);

  return (
    <>
      <section className="site-section pt-16 md:pt-24">
        <div className="kyns-shell">
          <Reveal>
            <SectionIntro
              eyebrow={aboutContent.hero.eyebrow}
              description={aboutContent.hero.description}
              title={aboutContent.hero.title}
            />
          </Reveal>
        </div>
      </section>

      <section className="site-section">
        <div className="kyns-shell">
          <SectionIntro
            eyebrow="PRIVACY ARCHITECTURE"
            description="Três passos, sem teatrinho. O tráfego é protegido, a resposta é entregue e os dados expiram automaticamente em 24 horas."
            title="Arquitetura de privacidade."
          />
          <HomeCardGrid cards={aboutContent.architectureSteps} icons={[Lock, Database, Shield]} />
        </div>
      </section>

      <section className="site-section">
        <div className="kyns-shell">
          <SectionIntro
            eyebrow="IA SEM VIÉS"
            description="A crítica do KYNS não é à segurança real. É ao uso do medo reputacional como desculpa para produzir respostas piores."
            title="O problema das IAs domesticadas."
          />
          <HomeCardGrid cards={aboutContent.biasBlocks} icons={[Scale, MessageSquare]} />
        </div>
      </section>

      <section className="site-section">
        <div className="kyns-shell grid gap-6 md:grid-cols-2">
          <Reveal>
            <div className="site-card h-full p-7 md:p-8">
              <span className="site-eyebrow">{aboutContent.openSource.eyebrow}</span>
              <h2 className="site-display mt-6 text-[clamp(2.2rem,4vw,3.4rem)] text-[#111111]">
                {aboutContent.openSource.title}
              </h2>
              <p className="mt-5 text-base leading-8 text-[#666666]">{aboutContent.openSource.description}</p>
            </div>
          </Reveal>
          <Reveal>
            <div className="site-card h-full p-7 md:p-8">
              <span className="site-eyebrow">{aboutContent.responsibility.eyebrow}</span>
              <h2 className="site-display mt-6 text-[clamp(2.2rem,4vw,3.4rem)] text-[#111111]">
                {aboutContent.responsibility.title}
              </h2>
              <p className="mt-5 text-base leading-8 text-[#666666]">{aboutContent.responsibility.description}</p>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

export function SitePhilosophyPage() {
  useSiteMeta(pageMeta.philosophy);

  return (
    <>
      <section className="site-section pt-16 md:pt-24">
        <div className="kyns-shell">
          <Reveal>
            <SectionIntro
              eyebrow={philosophyIntro.eyebrow}
              description={philosophyIntro.description}
              title={philosophyIntro.title}
            />
          </Reveal>
        </div>
      </section>

      <section className="site-section pt-0">
        <div className="kyns-shell grid gap-8">
          {philosophyPillars.map((pillar) => (
            <PhilosophySection key={pillar.id} pillar={pillar} />
          ))}
        </div>
      </section>

      <section className="site-section">
        <div className="kyns-shell">
          <Reveal>
            <div className="site-card p-8 md:p-10">
              <span className="site-eyebrow">{PHILOSOPHY_SUMMARY_LABEL}</span>
              <div className="mt-8 grid gap-10 lg:grid-cols-[0.95fr,1.05fr]">
                <div>
                  <h2 className="site-display text-[clamp(2.4rem,5vw,4.2rem)] text-[#111111]">
                    Seis princípios. Uma linha simples.
                  </h2>
                  <p className="mt-6 text-lg leading-8 text-[#666666]">{toolResponsibilityQuote}</p>
                </div>
                <div className="grid gap-4">
                  {philosophySummary.map((item) => (
                    <div
                      key={item}
                      className="rounded-[22px] border border-black/6 bg-white/80 px-5 py-4 text-base leading-7 text-[#111111]"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

export function SiteTransparencyPage() {
  useSiteMeta(pageMeta.transparency);

  return (
    <>
      <section className="site-section pt-16 md:pt-24">
        <div className="kyns-shell">
          <Reveal>
            <SectionIntro
              eyebrow={transparencyContent.hero.eyebrow}
              description={transparencyContent.hero.description}
              title={transparencyContent.hero.title}
            />
          </Reveal>
        </div>
      </section>


      <section className="site-section">
        <div className="kyns-shell grid gap-6 lg:grid-cols-2">
          <Reveal>
            <div className="site-card h-full p-7 md:p-8">
              <div className="flex items-center gap-3">
                <Database className="size-5 text-[#b89555]" />
                <span className="site-eyebrow">O QUE ARMAZENAMOS</span>
              </div>
              <div className="mt-6 space-y-4">
                {transparencyContent.storageAllowed.map((item) => (
                  <div key={item} className="rounded-[20px] border border-black/6 bg-white/70 px-5 py-4 text-base leading-7 text-[#111111]">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal>
            <div className="site-card h-full p-7 md:p-8">
              <div className="flex items-center gap-3">
                <Shield className="size-5 text-[#b89555]" />
                <span className="site-eyebrow">O QUE NÃO ARMAZENAMOS</span>
              </div>
              <div className="mt-6 space-y-4">
                {transparencyContent.storageNotAllowed.map((item) => (
                  <div key={item} className="rounded-[20px] border border-black/6 bg-white/70 px-5 py-4 text-base leading-7 text-[#111111]">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="site-section">
        <div className="kyns-shell">
          <SectionIntro
            eyebrow="COMO FUNCIONA"
            description="Fluxo simplificado de dados: pouco armazenamento, entrega direta e separação entre conteúdo e telemetria técnica."
            title="Da pergunta até a resposta."
          />
          <HomeCardGrid cards={transparencyContent.flowSteps} icons={[Database, Lock, BookOpen, Shield]} />
        </div>
      </section>

      <section className="site-section">
        <div className="kyns-shell">
          <SectionIntro
            eyebrow="MODELOS"
            description="O KYNS não vende uma caixa-preta mística. Ele expõe a família de modelos e o papel que cada camada cumpre."
            title="Quais modelos usamos."
          />
          <HomeCardGrid cards={transparencyContent.models} icons={[Sparkles, Scale, ImageIcon]} />
        </div>
      </section>

      <section className="site-section">
        <div className="kyns-shell">
          <SectionIntro
            eyebrow="LIMITES"
            description="A linha não é “isso me ofende”. A linha é dano direto, exploração de vítima e risco catastrófico."
            title="O que bloqueamos e por quê."
          />
          <HomeCardGrid cards={transparencyContent.limits} icons={[Shield, Scale, Sparkles]} />
        </div>
      </section>

      <section className="site-section">
        <div className="kyns-shell">
          <SectionIntro
            eyebrow="CÓDIGO ABERTO"
            description="Os links abaixo apontam para a base pública que informa a experiência e a configuração descritas pela marca."
            title="Repositórios públicos relevantes."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {transparencyContent.openSourceLinks.map((item) => (
              <Reveal key={item.href}>
                <a
                  className="site-card block h-full p-6 text-inherit no-underline md:p-7"
                  href={item.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="site-eyebrow">REPOSITÓRIO</span>
                    <ExternalLink className="size-4 text-[#b89555]" />
                  </div>
                  <h3 className="mt-6 text-2xl font-semibold text-[#111111]">{item.label}</h3>
                  <p className="mt-4 text-base leading-8 text-[#666666]">{item.description}</p>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export function SiteFAQPage() {
  useSiteMeta(pageMeta.faq);

  return (
    <>
      <section className="site-section pt-16 md:pt-24">
        <div className="kyns-shell">
          <Reveal>
            <SectionIntro
              eyebrow="FAQ"
              description="Perguntas frequentes sobre conta, privacidade, modelos, limites e funcionamento prático do KYNS."
              title="Perguntas frequentes."
            />
          </Reveal>
        </div>
      </section>
      {faqCategories.map((category) => (
        <FAQCategorySection key={category.title} category={category} />
      ))}
    </>
  );
}

export function SiteTermsPage() {
  return <LegalMarkdownPage pageKey="terms" />;
}

export function SitePrivacyPage() {
  return <LegalMarkdownPage pageKey="privacy" />;
}

export function SiteContentPolicyPage() {
  return <LegalMarkdownPage pageKey="contentPolicy" />;
}

export function SiteAcceptableUsePage() {
  return <LegalMarkdownPage pageKey="acceptableUse" />;
}

export function SiteNotFoundPage() {
  useSiteMeta({ path: '/404', title: 'Página não encontrada | KYNS', description: '' });

  return (
    <section className="site-section flex min-h-[60vh] items-center pt-16 md:pt-24">
      <div className="kyns-shell text-center">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#8d8d8d]">404</p>
          <h1 className="mt-6 text-4xl font-semibold text-[#111111] md:text-5xl">
            Página não encontrada.
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-base leading-8 text-[#666666]">
            O endereço que você tentou acessar não existe ou foi movido.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-6 py-3 text-sm font-medium text-white no-underline transition hover:bg-[#333333]"
            >
              Voltar ao início
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function SiteContactPage() {
  useSiteMeta(pageMeta.contact);

  return (
    <section className="site-section pt-16 md:pt-24">
      <div className="kyns-shell">
        <Reveal>
          <SectionIntro
            eyebrow={contactContent.eyebrow}
            description={contactContent.description}
            title={contactContent.title}
          />
        </Reveal>

        <Reveal className="mt-10">
          <div className="site-card p-8 md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#8d8d8d]">
                  E-mail único
                </p>
                <a
                  className="mt-4 inline-flex items-center gap-3 text-2xl font-semibold text-[#111111] no-underline md:text-3xl"
                  href={`mailto:${siteConfig.contactEmail}`}
                >
                  <Mail className="size-5 text-[#b89555]" />
                  {contactContent.emailLabel}
                </a>
              </div>
              <p className="max-w-md text-base leading-8 text-[#666666]">
                Responderemos por esse canal para suporte, copyright, privacidade, cobrança, relatos e assuntos gerais.
              </p>
            </div>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {contactContent.supportCards.map((card) => (
            <Reveal key={card.title}>
              <div className="site-card h-full p-6 md:p-7">
                <span className="site-eyebrow">{card.eyebrow}</span>
                <h3 className="mt-6 text-2xl font-semibold text-[#111111]">{card.title}</h3>
                <p className="mt-4 text-base leading-8 text-[#666666]">{card.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
