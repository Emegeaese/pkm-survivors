# PKM Survivors

Adaptación de [Pokémon Survivors de Pedro Barretto](https://github.com/pedrobarretto/pokemon-survivors), con reglas de tickets inspiradas en [Emegeaese/poke-survivors](https://github.com/Emegeaese/poke-survivors).

- **568 Pokémon jugables** con recursos ya incluidos, desde los iniciales hasta especies salvajes y legendarias.
- **Gacha por tickets** en nueve regiones: ×1, ×10, garantías, repetidos y variantes shiny disponibles. Tres iniciales gratuitos para comenzar a ganar tickets.
- **Cooperativo online de 2–4 jugadores**: enemigos y experiencia compartidos, mejoras individuales, reanimación, jefes, portales y continuación al modo sin fin.
- **Versus online de 2–4 jugadores**: último entrenador en pie, mejoras iguales y arena que se encoge.
- Juego individual, huevos, misiones, Poké Mart y guardados de la base original.

## Jugar en local

Necesitas Node.js 24 o posterior.

```sh
npm ci
npm run dev
```

Para activar las salas, en otra terminal:

```sh
npm run multiplayer
```

Abre la dirección de Vite y entra en **Play with friends**. Crea una sala, comparte el código, marca **Ready** en cada dispositivo e inicia desde el anfitrión.

## Publicar

El repositorio contiene el juego y el servidor. Para que amigos se conecten por Internet hay que desplegarlos en un host que soporte WebSockets; subir los archivos a GitHub por sí solo no inicia el servidor.

```sh
npm run build
npm run multiplayer
```

El servidor sirve el juego compilado en `http://localhost:8787` y las salas en `/rooms`. Se incluye un Dockerfile. Configura HTTPS y `ROOM_ORIGINS` en producción; si el frontend está separado, configura `VITE_ROOM_URL` antes de compilar. `VITE_SITE_URL` establece la URL pública para los metadatos del sitio.

Las cuentas son opcionales. La API de cuentas original está en `server/src`, con su propia configuración; el relay de amigos está en `server/rooms.mjs`. Los modos de amigos guardan progreso local y se mantienen fuera del ranking individual.

**[Reglas, despliegue, límites y mejoras propuestas](docs/ADAPTACION.md)** · [Documentación original](docs/UPSTREAM_README.md)

## Comprobaciones

```sh
npm test
npm run test:rooms
npm run build
npm ci --prefix server
npm run typecheck --prefix server
npm run build --prefix server
```

`npm run catalogue` actualiza los identificadores de especies y la lista del relay al ampliar los datos originales. La compilación lo ejecuta automáticamente.

## Créditos

Se conserva la licencia MIT del código original y sus atribuciones. Consulta [LICENSE](LICENSE) y [CREDITS.md](CREDITS.md) para los recursos y artistas. Pokémon pertenece a sus respectivos titulares. Este es un proyecto de fans no oficial y sin fines comerciales.
