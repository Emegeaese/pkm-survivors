# Adaptación de Emegeaese

Base: [pedrobarretto/pokemon-survivors](https://github.com/pedrobarretto/pokemon-survivors). Referencia: [Emegeaese/poke-survivors](https://github.com/Emegeaese/poke-survivors).

## Colección y progresión

El juego está traducido al español. La selección original muestra estadísticas, evoluciones, movimientos y especiales. Los 27 iniciales están disponibles; HUEVOS conserva las familias de incubación. «Todos los Pokémon» abre el catálogo de 568 opciones jugables. No incluye toda la Pokédex nacional.

Las 79 familias originales conservan sus datos. Las especies añadidas usan una etapa, movimientos de su tipo y estadísticas iniciales comunes. Necesitan balance y evoluciones específicas.

El gacha tiene nueve regiones, tiradas ×1/×10, garantía de 4★ en ×10 y un 5★ a más tardar en la tirada 70 por región. Tasas base 45/30/17/6,5/1,5%, ajustadas a las rarezas presentes. Donde no hay legendarios se destacan las especies más fuertes. Variocolor al 1% si existe su recurso gráfico. Los repetidos dan monedas; no hay compras reales.

Hay diez tickets iniciales y recompensas por tiempo, jefes y victoria en solitario y cooperativo. En versus, las partidas de al menos un minuto dan un ticket de participación y dos adicionales al ganador. Los huevos avanzan con los pasos y desbloquean familias jugables.

El gacha presenta una ruleta de 2,8 segundos, que puede omitirse y respeta la preferencia de movimiento reducido. Guarda el coste y los premios antes de animarlos y bloquea tiradas simultáneas.

## Amigos e intercambios

Desde «Jugar con amigos → Amigos» puedes enviar solicitudes por @apodo, aceptarlas, rechazarlas, cancelarlas, quitar amigos y abrir sus estadísticas. Los perfiles incluyen las marcas individuales y seis registros multijugador: partidas y victorias cooperativas, minutos cooperativos, reanimaciones realizadas, partidas y victorias versus. Los contadores nuevos empiezan a registrarse en esta versión.

Los amigos confirmados pueden intercambiar copias del gacha, normales y shiny. Los iniciales gratuitos y los desbloqueos de huevos no generan copias intercambiables. Cada oferta requiere confirmación de ambos; cambiarla invalida ambas confirmaciones. El cierre actualiza los débitos y créditos de los dos jugadores y el recibo en una sola transacción Firestore. Las reglas rechazan el cierre parcial, los cambios de oferta ajenos, los créditos inventados y el doble gasto de una copia entre intercambios concurrentes.

`pkmTradeStock` conserva los contadores de copias ganadas, enviadas y recibidas fuera del guardado offline. El guardado conserva una caché de transferencias combinada por máximos; sincronizar un dispositivo antiguo no restaura una copia enviada. La animación muestra el intercambio ya confirmado y el historial permite consultar el resultado al volver. Las variantes shiny se contabilizan por copia desde esta versión; una variante desbloqueada anteriormente acredita una copia al migrar, porque antes solo se guardaba un booleano. Los shiny de una tirada de inicio afortunada y de huevos siguen siendo desbloqueos permanentes.

El registro de transferencias es validado por reglas, pero las copias ganadas se acreditan a partir del guardado del gacha del jugador. Esto no añade verificación independiente de tiradas contra clientes modificados. Actualiza el juego en todos los dispositivos antes de usar intercambios: versiones anteriores no conocen los campos nuevos del inventario.

## Firebase

Proyecto: `pokesurvivors`. Sitio independiente: `pkm-survivors-emegeaese`. La configuración web pública está en `src/firebase.ts`.

Para un nuevo dominio hay que autorizarlo en dos lugares: Firebase Authentication → dominios autorizados y Google Cloud → restricciones de sitios web de la clave web. La clave actual permite `https://pkm-survivors-emegeaese.web.app` y `https://pkm-survivors-emegeaese.firebaseapp.com`, incluyendo sus rutas (`/*`). Se conservan los dominios anteriores y las restricciones de APIs. Un error `API_KEY_HTTP_REFERRER_BLOCKED` significa que falta esta segunda autorización, aunque Authentication ya tenga el dominio añadido. Comprueba el registro real desde el sitio publicado; los emuladores no reproducen estas restricciones.

Se usan las cuentas existentes de Firebase Authentication con correo y contraseña. El registro y la recuperación de contraseña están en el juego. No hace falta cuenta para jugar en solitario; sí para salas y resultados online. Esta adaptación no modifica ni importa automáticamente los guardados del juego anterior, cuyo formato es diferente.

Firestore usa `pkmSaves`, `pkmProfiles`, `pkmHandles`, `pkmStats`, `pkmStarts`, `pkmRuns`, `pkmBoards`, `pkmFollows` y `pkmFans`. Realtime Database usa `pkm2Rooms` y `pkm2Signals`. Los archivos `firebase.pkm.*` contienen los fragmentos añadidos; las reglas completas conservan las rutas anteriores.

Las funciones sociales añaden `pkmFriendships`, `pkmTrades` y `pkmTradeStock`. Las amistades e intercambios solo pueden leerlos sus participantes; el inventario de intercambio puede leerlo su dueño y sus amigos confirmados. No se publican correos ni guardados privados.

Las salas privadas admiten 2–4 jugadores. Firebase gestiona membresía y señalización; WebRTC transmite entradas cuando hay conexión directa y Firebase actúa como retransmisión alternativa. El anfitrión ordena las entradas y todos simulan el mismo mundo. Se comparan resúmenes del estado y se termina la sala si divergen. Una desconexión termina la sesión; aún no hay reconexión, transferencia de anfitrión ni entrada a media partida.

Cooperativo comparte mundo, experiencia, enemigos, jefes, portales y pausas, con mejoras individuales y reanimación tras cinco segundos junto a un aliado. El anfitrión decide continuar al modo sin fin. Versus usa mejoras iniciales equivalentes y una arena que se encoge; gana el último entrenador en pie.

Al caer puedes observar a los entrenadores vivos con los botones de pantalla o Q/E. La cámara vuelve al jugador al revivir y cambia de objetivo si muere el observado. La reanimación muestra el mismo círculo de progreso que los cofres, con porcentaje; alejarse reinicia el progreso. Al completarse se acredita una reanimación al aliado vivo más cercano.

El lote de retransmisión de Firebase se envía cada 50 ms, frente a los 200 ms anteriores, y se omiten las confirmaciones sin checksum. Una prueba local con cuatro clientes y retransmisión forzada, alternando diez entradas, midió medianas de 195 ms con la espera anterior y 95 ms con la nueva; los checksums compartidos coincidieron. Es una medición local de entrada y respuesta, no una garantía de latencia en internet.

## Misiones, logros y economía

Las misiones originales se mantienen. Cada día se añaden cinco minutos cooperativos (2 tickets), una reanimación (2), dos versus completos (2) y una victoria versus (2). Cada semana hay dos victorias cooperativas (10 tickets) y cinco versus (10). Los versus de menos de un minuto o interrumpidos no cumplen las misiones de partidas/victorias ni cobran participación. Las recompensas se conceden automáticamente y una misión completada no vuelve a pagarse.

Hay seis logros nuevos: primer cooperativo completado, cinco victorias cooperativas, diez reanimaciones, primer versus completado, diez victorias versus y cincuenta versus completados. Los resultados multijugador muestran los tickets obtenidos, incluidas las misiones. Continuar una victoria cooperativa al modo sin fin conserva el progreso de esa misma partida.

El balance del 16 de octubre reduce los ingresos manteniendo los precios y las compras existentes: monedas de enemigos normales al 1,8% + 0,2% por punto de experiencia, con límite del 4,5%; jefes de ₽500 a ₽200 y shiny de ₽150 a ₽70. El bonus pasa de ₽30 a ₽20 por minuto, de ₽0,25 a ₽0,15 por enemigo y de ₽1000 a ₽600 por victoria. El minuto sin fin paga ₽60 en total en lugar de ₽90; Arceus paga ₽1500 en lugar de ₽5000. El multiplicador de codicia del bonus tiene límite ×2,5. Las misiones y los logros siguen aportando premios extraordinarios: esto no establece un tope total por partida. Sin datos del intento reportado, no se atribuye su recompensa de ₽20 000 a una única causa.

La caja del PC libera sus elementos y controles al cerrarse, protege las aperturas repetidas y permite volver desde la tarjeta de entrenador. Su diálogo se desplaza cuando supera la altura disponible. También se ajustaron los paneles, los nombres largos y las estadísticas de perfiles para pantallas pequeñas.

## Clasificaciones

Solitario y cooperativo ordenan por tiempo y separan dificultades. Cooperativo distingue equipos de 2, 3 y 4. Versus acumula victorias. Hay tablas diarias, semanales e históricas; día y semana siguen la hora de Ciudad de México, con semana desde el lunes.

La pantalla destaca tu fila y posición dentro de los 50 primeros, permite desplazarte a ella, filtrar los amigos presentes en esos 50 y abrir perfiles desde los nombres. Los empates se resuelven por Pokémon derrotados y fecha del resultado. El filtro de amigos conserva las posiciones globales y no representa una tabla exhaustiva de todos los amigos fuera del top 50.

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
4. Invitaciones desde la lista de amigos, presencia en línea, rondas versus y equipos 2 contra 2.
5. Historial del gacha y probabilidades efectivas por región.
6. Migrar a Firebase las recompensas automáticas por referidos y cintas del sistema anterior, que todavía dependen de su API original.

Se conservan las licencias y los créditos del código y los recursos originales.
