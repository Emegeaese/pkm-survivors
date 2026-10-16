# PKM Survivors

Adaptación de [Pokémon Survivors de Pedro Barretto](https://github.com/pedrobarretto/pokemon-survivors), con el proyecto Firebase de [Emegeaese/poke-survivors](https://github.com/Emegeaese/poke-survivors).

**[Jugar en español](https://pkm-survivors-emegeaese.web.app/es/)**

- Español, portugués e inglés. Selección original con estadísticas, evoluciones, movimientos y huevos.
- Los **27 iniciales** disponibles desde el principio; **568 Pokémon jugables** en el catálogo. Desbloqueos por gacha de tickets o huevos y variantes variocolor jugables cuando existe su recurso gráfico.
- Cooperativo y versus para **2–4 jugadores**, con salas privadas por código mediante **Firebase**.
- Cuentas con **correo y contraseña**, recuperación de contraseña y guardado en Firestore. Sirven las cuentas existentes del mismo proyecto Firebase; el progreso de esta adaptación se guarda por separado.
- Clasificaciones de **solitario, cooperativo y versus**, diarias, semanales e históricas. Cooperativo separa equipos de dos, tres y cuatro; versus cuenta victorias.

## Ejecutar

Necesitas Node.js 24 o posterior.

```sh
npm ci
npm run dev
```

La configuración web pública de Firebase está incluida. Las salas requieren iniciar sesión con correo. No hace falta ejecutar un servidor WebSocket ni escribir su dirección en el juego.

## Publicar

El proyecto es `pokesurvivors`. El sitio de esta adaptación es `pkm-survivors-emegeaese`, separado del juego anterior. Consulta `.env.example` para otro proyecto o los emuladores.

```sh
npx firebase-tools login
npm run build
npx firebase-tools deploy --project pokesurvivors
```

`firestore.rules` y `database.rules.json` preservan las reglas anteriores y añaden rutas separadas. Antes de desplegar sobre otro proyecto, revisa estas reglas y el identificador de Hosting. `VITE_SITE_URL` fija la dirección pública de los metadatos.

## Comprobaciones

```sh
npm test
npm run build
npm run test:firebase
```

La integración Firebase requiere Java 21+ y ejecuta emuladores bajo un proyecto de demostración, sin tocar datos reales. Verifica guardados privados, nombres únicos, resultados, equipos, victorias, intentos diarios y permisos de salas.

El código anterior de la API y el relay permanece en `server/` como referencia; la interfaz actual utiliza Firebase. `npm run multiplayer` puede servir `dist` en el puerto 8787 como previsualización local.

## Alcance y mejoras

Las familias originales conservan evolución y estadísticas propias. Las especies añadidas son jugables en una etapa con estadísticas iniciales comunes; queda pendiente su balance y evoluciones específicas. Las reglas validan propiedad, formato y tiempo de las marcas; no simulan las partidas en un servidor independiente.

**[Detalles y mejoras propuestas](docs/ADAPTACION.md)** · [Documentación original](docs/UPSTREAM_README.md)

## Créditos

Se conservan `LICENSE` y `CREDITS.md`. El código original es MIT y los recursos mantienen sus propias licencias y atribuciones. Pokémon pertenece a sus titulares. Proyecto de fans no oficial y sin fines comerciales.
