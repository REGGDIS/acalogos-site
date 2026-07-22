import React, { useEffect, useRef, useState } from "react";

const HERO_IMAGES = [
    "/assets/images/hero/hero1.webp",
    "/assets/images/hero/hero3.webp",
    "/assets/images/hero/hero4.webp",
    "/assets/images/hero/hero5.webp",
    "/assets/images/hero/hero6.webp",
    "/assets/images/hero/hero7.webp",
];

const SLIDE_DURATION_MS = 2000;
const FADE_DURATION_MS = 500;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const HeroSection: React.FC = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [preparedSrc, setPreparedSrc] = useState<string | null>(null);
    const [dwellElapsed, setDwellElapsed] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(
        () => window.matchMedia(REDUCED_MOTION_QUERY).matches
    );
    const mountedRef = useRef(false);

    const nextIndex = (currentIndex + 1) % HERO_IMAGES.length;
    const incomingSrc = HERO_IMAGES[nextIndex];
    const incomingSrcRef = useRef(incomingSrc);
    incomingSrcRef.current = incomingSrc;

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
        const handleChange = (event: MediaQueryListEvent) => {
            setPrefersReducedMotion(event.matches);
        };

        mediaQuery.addEventListener("change", handleChange);

        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    useEffect(() => {
        setPreparedSrc(null);
        setDwellElapsed(false);
        setIsTransitioning(false);

        if (prefersReducedMotion) {
            return;
        }

        const dwellTimer = window.setTimeout(() => {
            setDwellElapsed(true);
        }, SLIDE_DURATION_MS);

        return () => window.clearTimeout(dwellTimer);
    }, [currentIndex, prefersReducedMotion]);

    useEffect(() => {
        if (
            !prefersReducedMotion
            && dwellElapsed
            && preparedSrc === incomingSrc
            && !isTransitioning
        ) {
            setIsTransitioning(true);
        }
    }, [dwellElapsed, incomingSrc, isTransitioning, prefersReducedMotion, preparedSrc]);

    useEffect(() => {
        if (!isTransitioning) {
            return;
        }

        const fadeTimer = window.setTimeout(() => {
            setIsTransitioning(false);
            setPreparedSrc(null);
            setDwellElapsed(false);
            setCurrentIndex((index) => (index + 1) % HERO_IMAGES.length);
        }, FADE_DURATION_MS);

        return () => window.clearTimeout(fadeTimer);
    }, [isTransitioning]);

    const handleIncomingLoad = async (event: React.SyntheticEvent<HTMLImageElement>) => {
        const image = event.currentTarget;
        const candidateSrc = image.dataset.heroSrc;

        if (!candidateSrc) {
            return;
        }

        try {
            if (typeof image.decode === "function") {
                await image.decode();
            }
        } catch {
            // The load event already fired, so continue as a decoding fallback.
        }

        if (mountedRef.current && incomingSrcRef.current === candidateSrc) {
            setPreparedSrc(candidateSrc);
        }
    };

    const visibleSlides = prefersReducedMotion
        ? [currentIndex]
        : [currentIndex, nextIndex];

    return (
        <section className="relative h-screen overflow-hidden bg-secondary">
            {visibleSlides.map((imageIndex) => {
                const src = HERO_IMAGES[imageIndex];
                const isCurrent = imageIndex === currentIndex;

                return (
                    <img
                        key={src}
                        src={src}
                        alt=""
                        aria-hidden="true"
                        loading="eager"
                        {...{ fetchpriority: imageIndex === 0 ? "high" : "auto" }}
                        data-hero-src={src}
                        onLoad={isCurrent ? undefined : handleIncomingLoad}
                        className={`pointer-events-none absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500 ease-in-out ${
                            isCurrent
                                ? "z-10 opacity-100"
                                : `z-20 ${isTransitioning ? "opacity-100" : "opacity-0"}`
                        }`}
                    />
                );
            })}

            <div className="relative z-30 h-full flex flex-col justify-center items-center bg-white bg-opacity-10 text-center text-white px-6">
                <h2 className="text-4xl md:text-6xl font-bold mb-4">Imprimimos tus ideas</h2>
                <p className="text-lg md:text-2xl mb-6">
                    Preparamos diseños únicos y personalizados para destacar tu marca.
                </p>
                <a
                    href="#contact"
                    className="bg-primary text-accent py-2 px-4 rounded-lg font-semibold hover:bg-highlight"
                >
                    Contáctanos
                </a>
            </div>
        </section>
    );
};

export default HeroSection;
