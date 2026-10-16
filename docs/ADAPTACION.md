# Adaptación de Emegeaese

Base: [pedrobarretto/pokemon-survivors](https://github.com/pedrobarretto/pokemon-survivors). Referencia: [Emegeaese/poke-survivors](https://github.com/Emegeaese/poke-survivors).

## Colección y progresión

El juego está traducido al español. La selección original muestra estadísticas, evoluciones, movimientos y especiales. Los 27 iniciales están disponibles; HUEVOS conserva las familias de incubación. «Todos los Pokémon» abre el catálogo de 568 opciones jugables. No incluye toda la Pokédex nacional.

Las 79 familias originales conservan sus datos. Las especies añadidas usan una etapa, movimientos de su tipo y estadísticas iniciales comunes. Necesitan balance y evoluciones específicas.

El gacha tiene nueve regiones, tiradas ×1/×10, garantía de 4★ en ×10 y un 5★ a más tardar en la tirada 70 por región. Tasas base 45/30/17/6,5/1,5%, ajustadas a las rarezas presentes. Donde no hay legendarios se destacan las especies más fuertes. Variocolor al 1% si existe su recurso gráfico. Los repetidos dan monedas; no hay compras reales.

Hay diez tickets iniciales y recompensas por tiempo, jefes y victoria en solitario y cooperativo. En versus, las partidas de al menos un minuto dan un ticket de participación y dos adicionales al ganador. Los huevos avanzan con los pasos y desbloquean familias jugables.

## Firebase

Proyecto: `pokesurvivors`. Sitio independiente: `pkm-survivors-emegeaese`. La configuración web pública está en `src/firebase.ts`.

Para un nuevo dominio hay que autorizarlo en dos lugares: Firebase Authentication → dominios autorizados y Google Cloud → restricciones de sitios web de la clave web. La clave actual permite `https://pkm-survivors-emegeaese.web.app` y `https://pkm-survivors-emegeaese.firebaseapp.com`, incluyendo sus rutas (`/*`). Se conservan los dominios anteriores y las restricciones de APIs. Un error `API_KEY_HTTP_REFERRER_BLOCKED` significa que falta esta segunda autorización, aunque Authentication ya tenga el dominio añadido. Comprueba el registro real desde el sitio publicado; los emuladores no reproducen estas restricciones.

Se usan las cuentas existentes de Firebase Authentication con correo y contraseña. El registro y la recuperación de contraseña están en el juego. No hace falta cuenta para jugar en solitario; sí para salas y resultados online. Esta adaptación no modifica ni importa automáticamente los guardados del juego anterior, cuyo formato es diferente.

Firestore usa `pkmSaves`, `pkmProfiles`, `pkmHandles`, `pkmStats`, `pkmStarts`, `pkmRuns`, `pkmBoards`, `pkmFollows` y `pkmFans`. Realtime Database usa `pkm2Rooms` y `pkm2Signals`. Los archivos `firebase.pkm.*` contienen los fragmentos añadidos; las reglas completas conservan las rutas anteriores.

Las salas privadas admiten 2–4 jugadores. Firebase gestiona membresía y señalización; WebRTC transmite entradas cuando hay conexión directa y Firebase actúa como retransmisión alternativa. El anfitrión ordena las entradas y todos simulan el mismo mundo. Se comparan resúmenes del estado y se termina la sala si divergen. Una desconexión termina la sesión; aún no hay reconexión, transferencia de anfitrión ni entrada a media partida.

Cooperativo comparte mundo, experiencia, enemigos, jefes, portales y pausas, con mejoras individuales y reanimación tras cinco segundos junto a un aliado. El anfitrión decide continuar al modo sin fin. Versus usa mejoras iniciales equivalentes y una arena que se encoge; gana el último entrenador en pie.

## Clasificaciones

Solitario y cooperativo ordenan por tiempo y separan dificultades. Cooperativo distingue equipos de 2, 3 y 4. Versus acumula victorias. Hay tablas diarias, semanales e históricas; día y semana siguen la hora de Ciudad de México, con semana desde el lunes.

Los resultados requieren un inicio registrado por la misma cuenta. Las reglas verifican equipo, formato y tiempo; impiden escribir la fila individual de otra cuenta y contar dos veces la misma victoria. El primer resultado del desafío diario se conserva; continuar ese intento puede mejorarlo. Los envíos fallidos quedan pendientes por cuenta y se reintentan al reconectar.

La simulación, el inventario y los tickets se calculan en el cliente. Un cliente modificado aún puede alterar resultados y progreso. No hay verificación independiente de la simulación. Los guardados offline se combinan mediante máximos y unión de colecciones, como en la base; no son un monedero transaccional.

## Pruebas y publicación

```sh
npm ci
npm test
npm run test:firebase
npm run build
npx firebase-tools deploy --project pokesurvivors
```

La integración Firebase utiliza emuladores y el proyecto `demo-pkm-survivors`. Para pruebas manuales, inicia `npx firebase-tools emulators:start --project demo-pkm-survivors --only auth,database,firestore` y usa las variables de demostración de `.env.example` al iniciar Vite. No compiles para producción con emuladores activados.

## Mejoras propuestas

1. Validación de partidas e inventario en un servidor para una clasificación competitiva fiable.
2. Balance, estadísticas y evoluciones específicas de las especies añadidas.
3. Reconexión y transferencia de anfitrión.
4. Invitaciones desde la cuenta, amigos conectados, rondas versus y equipos 2 contra 2.
5. Misiones con tickets ×10, historial del gacha y probabilidades efectivas por región.
6. Migrar a Firebase las recompensas automáticas por referidos y cintas del sistema anterior, que todavía dependen de su API original.

Se conservan las licencias y los créditos del código y los recursos originales.
