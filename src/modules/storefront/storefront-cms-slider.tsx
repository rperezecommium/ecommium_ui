"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { A11y, Autoplay, Keyboard } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperInstance } from "swiper/types";
import "swiper/css";

import type { StorefrontCmsBlock } from "./public-page-contract";

type SliderSlide = {
  backgroundPosition: string;
  contentPosition: "left" | "center" | "right";
  ctaHref: string;
  ctaLabel: string;
  imageAlt: string;
  imageUrl: string;
  subtitle: string;
  title: string;
};

const backgroundPositions = new Set([
  "left top", "center top", "right top",
  "left center", "center center", "right center",
  "left bottom", "center bottom", "right bottom",
]);

export function StorefrontCmsSlider({ block }: { block: StorefrontCmsBlock }) {
  const swiperRef = useRef<SwiperInstance | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const slides = sliderSlides(block.props.slides);
  const autoplay = block.props.autoplay === true && slides.length > 1 && !reducedMotion;
  const label = safeText(block.props.heading, 120) || "Contenido destacado";
  const style = {
    "--cms-slider-height-desktop": `${boundedNumber(block.props.heightDesktop, 380, 220, 720)}px`,
    "--cms-slider-height-tablet": `${boundedNumber(block.props.heightTablet, 350, 220, 720)}px`,
    "--cms-slider-height-mobile": `${boundedNumber(block.props.heightMobile, 320, 220, 720)}px`,
    "--cms-slider-overlay-opacity": boundedNumber(block.props.overlayOpacity, 28, 0, 80) / 100,
  } as CSSProperties;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const swiper = swiperRef.current;
    if (!swiper?.autoplay) return;
    if (reducedMotion || block.props.autoplay !== true) {
      swiper.autoplay.stop();
      return;
    }
    swiper.autoplay.start();
  }, [block.props.autoplay, reducedMotion]);

  if (slides.length === 0) return null;

  return (
    <section
      aria-label={label}
      aria-roledescription="carrusel"
      className="storefrontCmsSlider storefrontCmsSliderInteractive"
      data-testid="cms-home-slider"
      role="region"
      style={style}
    >
      <Swiper
        a11y={{
          enabled: true,
          itemRoleDescriptionMessage: "diapositiva",
          nextSlideMessage: "Mostrar diapositiva siguiente",
          prevSlideMessage: "Mostrar diapositiva anterior",
          slideLabelMessage: "{{index}} de {{slidesLength}}",
        }}
        allowTouchMove={slides.length > 1}
        autoplay={autoplay ? {
          delay: boundedNumber(block.props.autoplayDelay, 2500, 1500, 15000),
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        } : false}
        className="storefrontCmsSliderViewport"
        keyboard={{ enabled: true, onlyInViewport: true }}
        loop={slides.length > 1}
        modules={[A11y, Autoplay, Keyboard]}
        onSwiper={(swiper) => { swiperRef.current = swiper; }}
        speed={reducedMotion ? 0 : 420}
      >
        {slides.map((slide, index) => (
          <SwiperSlide key={`${slide.title}-${slide.imageUrl}-${index}`}>
            <article className={`storefrontCmsSliderSlide storefrontCmsSliderContent${capitalize(slide.contentPosition)}`}>
              <Image
                alt={slide.imageAlt || slide.title}
                className="storefrontCmsSliderImage"
                fill
                priority={index === 0}
                sizes="100vw"
                src={slide.imageUrl}
                style={{ objectPosition: slide.backgroundPosition }}
                unoptimized
              />
              <div className="storefrontCmsSliderShade" aria-hidden="true" />
              <div className="storefrontCmsSliderCopy">
                <h2>{slide.title}</h2>
                {slide.subtitle ? <p>{slide.subtitle}</p> : null}
                {slide.ctaLabel && slide.ctaHref ? (
                  slide.ctaHref.startsWith("/") ? (
                    <Link className="storefrontCmsSliderAction" href={slide.ctaHref}>{slide.ctaLabel}</Link>
                  ) : (
                    <a className="storefrontCmsSliderAction" href={slide.ctaHref} rel="noreferrer">{slide.ctaLabel}</a>
                  )
                ) : null}
              </div>
            </article>
          </SwiperSlide>
        ))}
      </Swiper>
      {slides.length > 1 ? (
        <>
          <button
            aria-label="Mostrar diapositiva anterior"
            className="storefrontCmsSliderArrow storefrontCmsSliderArrowPrevious"
            onClick={() => swiperRef.current?.slidePrev()}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={34} strokeWidth={1.8} />
          </button>
          <button
            aria-label="Mostrar diapositiva siguiente"
            className="storefrontCmsSliderArrow storefrontCmsSliderArrowNext"
            onClick={() => swiperRef.current?.slideNext()}
            type="button"
          >
            <ChevronRight aria-hidden="true" size={34} strokeWidth={1.8} />
          </button>
        </>
      ) : null}
    </section>
  );
}

function sliderSlides(value: unknown): SliderSlide[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const slide = entry as Record<string, unknown>;
    const imageUrl = safeImageUrl(slide.imageUrl);
    if (!imageUrl) return [];
    const contentPosition = slide.contentPosition === "center" || slide.contentPosition === "right"
      ? slide.contentPosition
      : "left";
    const requestedPosition = safeText(slide.backgroundPosition, 40);
    return [{
      backgroundPosition: backgroundPositions.has(requestedPosition) ? requestedPosition : "center center",
      contentPosition,
      ctaHref: safeHref(slide.ctaHref),
      ctaLabel: safeText(slide.ctaLabel, 80),
      imageAlt: safeText(slide.imageAlt, 200),
      imageUrl,
      subtitle: safeText(slide.subtitle ?? slide.body, 500),
      title: safeText(slide.title, 160) || "Destacado",
    }];
  });
}

function safeImageUrl(value: unknown) {
  const candidate = safeText(value, 2000);
  if (candidate.startsWith("/")) return candidate;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function safeHref(value: unknown) {
  const candidate = safeText(value, 2000);
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function safeText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function boundedNumber(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
