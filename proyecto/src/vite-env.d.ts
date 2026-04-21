/// <reference types="vite/client" />

// Permite importar archivos CSS Modules sin errores de TypeScript
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
