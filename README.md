# MystyEngine Studio

MystyEngine Studio es una app web para crear aventuras point-and-click estilo Myst-like con un flujo completo de editor + runtime.

## Qué incluye

- Gestión de proyecto y escenas.
- Editor visual de escenas con:
  - Nombre, descripción e imagen de fondo.
  - Hotspots interactivos por porcentaje (x/y/ancho/alto).
  - Acciones por hotspot:
    - Ir a escena específica.
    - Mostrar diálogo.
  - Diálogos por escena (personaje + texto).
  - Música ambiental por escena (archivo, volumen, loop).
- Runtime integrado para probar la aventura sin salir del editor.
- Soporte para carpeta local de trabajo mediante **File System Access API**:
  - Abrir una carpeta local como workspace.
  - Guardar/cargar `mysty.project.json` dentro de esa carpeta.
  - Listar audios disponibles (`mp3`, `ogg`, `wav`, `m4a`) para música ambiental.

## Ejecución

Como es una app estática, basta con servir la carpeta.

Ejemplo con Python:

```bash
python3 -m http.server 4173
```

Luego abrir:

- `http://localhost:4173`

> Para usar el acceso directo a carpetas locales, utiliza Chrome o Edge recientes (File System Access API).

## Formato de proyecto

El proyecto se guarda en `mysty.project.json` con una estructura como:

```json
{
  "metadata": { "name": "Nuevo proyecto Myst-like", "version": 1, "createdAt": "..." },
  "settings": { "startSceneId": "scene_xxx", "allowKeyboardNav": true },
  "scenes": [
    {
      "id": "scene_xxx",
      "name": "Atrio",
      "description": "Entrada principal",
      "background": "assets/atrio.jpg",
      "hotspots": [
        {
          "id": "hotspot_xxx",
          "label": "Puerta",
          "x": 30,
          "y": 35,
          "width": 18,
          "height": 12,
          "action": { "type": "gotoScene", "targetSceneId": "scene_yyy", "dialogueId": "" }
        }
      ],
      "dialogues": [
        { "id": "dialogue_xxx", "speaker": "Narrador", "text": "Una brisa fría..." }
      ],
      "ambientTracks": [
        { "id": "track_xxx", "file": "ambient01.mp3", "volume": 0.4, "loop": true }
      ]
    }
  ]
}
```

## Siguientes mejoras recomendadas

- Multipista ambiental con priorización por estado.
- Sistema de inventario y condiciones lógicas (`if hasItem`).
- Árbol de diálogo con respuestas del jugador.
- Exportador de build standalone del runtime.
- Timeline de eventos y scripting visual.
