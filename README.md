# Practica de Cabeceras

Herramienta interactiva para memorizar los campos de las cabeceras TCP, UDP, IPv4 y Ethernet, rellenando diagramas proporcionales por bits (igual al formato que la profesora usa en el examen).

**[Abrir la practica](https://yukirito2.github.io/cabeceras-redes/)**

## Que hace

- Dibuja cada cabecera como cajas proporcionales al numero de bits de cada campo, igual que en la infografia del curso.
- Cada intento deja algunos campos visibles (de contexto) y otros en blanco para rellenar de memoria.
- Acepta variantes en catalan, castellano e ingles para cada campo (ej. "puerto origen" / "port origen" / "source port").
- Corrige al instante: verde si acertaste, rojo con la respuesta correcta si fallaste.
- "Nueva practica" vuelve a sortear que campos quedan en blanco cada vez, para no memorizar solo la posicion.
- "Ver clave" rellena todo para repasar antes de intentarlo de memoria.
- Guarda el conteo de aciertos/intentos en el navegador.

## Estructura

```
index.html      estructura de la pagina
css/styles.css  estilos, temas claro/oscuro y animaciones
js/app.js       datos exactos de cada cabecera y logica de la practica
```

Sin dependencias ni build: HTML, CSS y JS puro. Servido con GitHub Pages.
