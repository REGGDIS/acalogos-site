/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html", // Ruta al index.html dentro de la carpeta frontend
    "./src/**/*.{js,ts,jsx,tsx}", // Ruta a los archivos dentro de src
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        primary: "rgb(254, 0, 0)", // Rojo principal
        secondary: "#111111", // Negro
        accent: "#ffffff", // Blanco
        background: "#f5f5f5", // Gris claro
        highlight: "rgb(255, 91, 91)", // Rojo claro
        white: "#FFFFFF",
      },
    },
  },
  plugins: [],
};
