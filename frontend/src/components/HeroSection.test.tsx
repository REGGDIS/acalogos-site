import { StrictMode } from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HeroSection from "./HeroSection";

const HERO_1 = "/assets/images/hero/hero1.webp";
const HERO_3 = "/assets/images/hero/hero3.webp";
const HERO_4 = "/assets/images/hero/hero4.webp";

type MediaQueryListener = (event: MediaQueryListEvent) => void;

let prefersReducedMotion = false;
let mediaQueryListener: MediaQueryListener | undefined;
let removeEventListenerMock: ReturnType<typeof vi.fn>;

const getSlide = (container: HTMLElement, src: string) =>
    container.querySelector<HTMLImageElement>(`img[src="${src}"]`);

const prepareIncoming = async (image: HTMLImageElement) => {
    fireEvent.load(image);
    await act(async () => {
        await Promise.resolve();
    });
};

beforeEach(() => {
    vi.useFakeTimers();
    prefersReducedMotion = false;
    mediaQueryListener = undefined;
    removeEventListenerMock = vi.fn();

    vi.stubGlobal("matchMedia", vi.fn().mockImplementation(() => ({
        matches: prefersReducedMotion,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addEventListener: vi.fn((_type: string, listener: MediaQueryListener) => {
            mediaQueryListener = listener;
        }),
        removeEventListener: removeEventListenerMock,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })));

    Object.defineProperty(HTMLImageElement.prototype, "decode", {
        configurable: true,
        writable: true,
        value: vi.fn().mockResolvedValue(undefined),
    });
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (HTMLImageElement.prototype as Partial<HTMLImageElement>).decode;
});

describe("HeroSection", () => {
    it("muestra la primera imagen prioritaria y prepara solo la siguiente", () => {
        const { container } = render(<HeroSection />);
        const images = container.querySelectorAll("img[data-hero-src]");
        const current = getSlide(container, HERO_1);
        const incoming = getSlide(container, HERO_3);

        expect(images).toHaveLength(2);
        expect(current).toHaveAttribute("loading", "eager");
        expect(current).toHaveAttribute("fetchpriority", "high");
        expect(current).toHaveClass("opacity-100");
        expect(incoming).toHaveClass("opacity-0");
        expect(getSlide(container, HERO_4)).not.toBeInTheDocument();
    });

    it("no avanza hasta que la siguiente imagen está preparada y transcurren dos segundos", async () => {
        let resolveDecode!: () => void;
        vi.mocked(HTMLImageElement.prototype.decode).mockReturnValue(
            new Promise<void>((resolve) => {
                resolveDecode = resolve;
            })
        );
        const { container } = render(<HeroSection />);
        const incoming = getSlide(container, HERO_3)!;

        fireEvent.load(incoming);
        act(() => vi.advanceTimersByTime(2000));
        expect(incoming).toHaveClass("opacity-0");

        await act(async () => {
            resolveDecode();
            await Promise.resolve();
        });

        expect(incoming).toHaveClass("opacity-100");
        expect(getSlide(container, HERO_1)).toHaveClass("opacity-100");
    });

    it("no inicia el fundido antes de cumplir el tiempo de permanencia", async () => {
        const { container } = render(<HeroSection />);
        const incoming = getSlide(container, HERO_3)!;

        await prepareIncoming(incoming);
        act(() => vi.advanceTimersByTime(1999));
        expect(incoming).toHaveClass("opacity-0");

        act(() => vi.advanceTimersByTime(1));
        expect(incoming).toHaveClass("opacity-100");
    });

    it("continúa el fundido cuando decode rechaza después del evento load", async () => {
        vi.mocked(HTMLImageElement.prototype.decode).mockRejectedValueOnce(
            new Error("decode failed")
        );
        const { container } = render(<HeroSection />);
        const incoming = getSlide(container, HERO_3)!;

        await prepareIncoming(incoming);
        act(() => vi.advanceTimersByTime(2000));

        expect(incoming).toHaveClass("opacity-100");
        expect(getSlide(container, HERO_1)).toHaveClass("opacity-100");
    });

    it("conserva la anterior durante el fundido y luego prepara exclusivamente la próxima", async () => {
        const { container } = render(<HeroSection />);
        const incoming = getSlide(container, HERO_3)!;

        await prepareIncoming(incoming);
        act(() => vi.advanceTimersByTime(2000));

        expect(getSlide(container, HERO_1)).toHaveClass("opacity-100");
        expect(incoming).toHaveClass("opacity-100");

        act(() => vi.advanceTimersByTime(499));
        expect(getSlide(container, HERO_1)).toBeInTheDocument();

        act(() => vi.advanceTimersByTime(1));
        expect(getSlide(container, HERO_1)).not.toBeInTheDocument();
        expect(getSlide(container, HERO_3)).toHaveClass("opacity-100");
        expect(getSlide(container, HERO_4)).toHaveClass("opacity-0");
        expect(container.querySelectorAll("img[data-hero-src]")).toHaveLength(2);
    });

    it("desactiva la precarga, el fundido y la rotación con reduced motion", () => {
        prefersReducedMotion = true;
        const { container } = render(<HeroSection />);

        expect(container.querySelectorAll("img[data-hero-src]")).toHaveLength(1);
        expect(getSlide(container, HERO_1)).toHaveClass("opacity-100");

        act(() => vi.advanceTimersByTime(10000));
        expect(getSlide(container, HERO_1)).toBeInTheDocument();
        expect(getSlide(container, HERO_3)).not.toBeInTheDocument();
    });

    it("cancela temporizadores y listeners al desmontar incluso bajo Strict Mode", async () => {
        let resolveDecode!: () => void;
        vi.mocked(HTMLImageElement.prototype.decode).mockReturnValue(
            new Promise<void>((resolve) => {
                resolveDecode = resolve;
            })
        );
        const { container, unmount } = render(
            <StrictMode>
                <HeroSection />
            </StrictMode>
        );

        expect(vi.getTimerCount()).toBe(1);
        fireEvent.load(getSlide(container, HERO_3)!);
        unmount();
        expect(vi.getTimerCount()).toBe(0);
        expect(removeEventListenerMock).toHaveBeenCalledWith("change", expect.any(Function));

        await act(async () => {
            resolveDecode();
            await Promise.resolve();
        });
        expect(vi.getTimerCount()).toBe(0);
    });

    it("detiene el ciclo si reduced motion se activa durante la permanencia", () => {
        const { container } = render(<HeroSection />);

        expect(mediaQueryListener).toBeTypeOf("function");
        act(() => {
            mediaQueryListener!({ matches: true } as MediaQueryListEvent);
        });

        expect(container.querySelectorAll("img[data-hero-src]")).toHaveLength(1);
        expect(vi.getTimerCount()).toBe(0);
    });
});
