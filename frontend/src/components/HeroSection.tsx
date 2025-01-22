import React, { useState, useEffect } from "react";

const HeroSection: React.FC = () => {
    const images = [
        "/assets/images/hero/hero1.webp",
        "/assets/images/hero/hero3.webp",
        "/assets/images/hero/hero4.webp",
        "/assets/images/hero/hero5.webp",
        "/assets/images/hero/hero6.webp",
        "/assets/images/hero/hero7.webp",
    ];

    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentImageIndex((prevIndex) =>
                prevIndex === images.length - 1 ? 0 : prevIndex + 1
            );
        }, 2000); // Cambia cada 2 segundos

        return () => clearInterval(interval); // Limpia el intervalo al desmontar
    }, [images.length]);

    return (
        <section
            className="bg-cover bg-center h-screen"
            style={{
                backgroundImage: `url('${images[currentImageIndex]}')`,
                transition: "background-image 0.5s ease-in-out",
            }}
        >
            <div className="h-full flex flex-col justify-center items-center bg-white bg-opacity-10 text-center text-white px-6">
                <h2 className="text-4xl md:text-6xl font-bold mb-4">Diseñamos tus ideas</h2>
                <p className="text-lg md:text-2xl mb-6">
                    Creamos diseños únicos y personalizados para destacar tu marca.
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