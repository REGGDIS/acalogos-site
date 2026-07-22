import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Footer from "./Footer";

describe("Footer", () => {
    it("muestra los datos de contacto con enlaces accesibles y seguros", () => {
        render(<Footer />);

        expect(screen.getByText("Dirección: Chorrillos N° 280, Los Ángeles, Chile")).toBeInTheDocument();

        const phoneLink = screen.getByRole("link", { name: "Teléfono: 998256902" });
        expect(phoneLink).toHaveAttribute("href", "tel:+56998256902");

        const whatsappLink = screen.getByRole("link", { name: "WhatsApp: +56 9 9825 6902" });
        expect(whatsappLink).toHaveAttribute("href", "https://wa.me/56998256902");
        expect(whatsappLink).toHaveAttribute("target", "_blank");
        expect(whatsappLink).toHaveAttribute("rel", "noopener noreferrer");
        expect(whatsappLink.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    });

    it("genera el año actual y elimina el nombre personal anterior", () => {
        render(<Footer />);

        const currentYear = new Date().getFullYear();
        expect(
            screen.getByText(`© ${currentYear} ACALogos. Todos los derechos reservados.`),
        ).toBeInTheDocument();
        expect(screen.queryByText(/Roberto Emilio González Guzmán/i)).not.toBeInTheDocument();
    });

    it("conserva el mapa y los enlaces rápidos", () => {
        render(<Footer />);

        const map = screen.getByTitle("Mapa de ubicación");
        expect(map.getAttribute("src")).toContain("https://www.google.com/maps/embed");
        expect(screen.getByRole("link", { name: "Servicios" })).toHaveAttribute("href", "#services");
        expect(screen.getByRole("link", { name: "Portafolio" })).toHaveAttribute("href", "#portfolio");
        expect(screen.getByRole("link", { name: "Contáctanos" })).toHaveAttribute("href", "#contact");
    });
});
