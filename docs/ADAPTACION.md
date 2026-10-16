# PKM Survivors: adaptación de Emegeaese

Base: [pedrobarretto/pokemon-survivors](https://github.com/pedrobarretto/pokemon-survivors).
Referencia de las reglas de tickets y gacha: [Emegeaese/poke-survivors](https://github.com/Emegeaese/poke-survivors).

## Lo que incluye

- Catálogo de **568 especies** que ya cuentan con datos y recursos en la base. No se afirma que incluya toda la Pokédex nacional. Las 79 familias originales conservan sus estadísticas, movimientos y evoluciones; las demás especies se juegan en una sola etapa con movimientos de su tipo y estadísticas iniciales comunes. Esto permite jugarlas, pero todavía necesita balance específico por especie.
- Bulbasaur, Charmander y Squirtle iniciales. El resto se obtiene con tickets en nueve banners regionales. Los huevos originales siguen siendo una vía alternativa de desbloqueo.
- Diez tickets iniciales; uno cada dos minutos, dos por jefe y cinco por victoria. Las recompensas parciales y las del modo sin fin se contabilizan por diferencia, sin volver a pagar lo ya cobrado.
- Tiradas ×1 y ×10, garantía de 4★ o más en ×10, 5★ a más tardar en la tirada 70 por región. Tasas base 45/30/17/6,5/1,5%; se condicionan a las rarezas presentes en cada región. Si no hay legendarios en una región, su rareza más alta se presenta como 5★. Repetidos pagan monedas. Shiny al 1% para especies con recursos shiny; se guarda y se puede elegir para jugar.
- Tickets ×10 especiales: compatibles con el guardado y el gacha; actualmente se ganan tickets normales jugando. No hay compras con dinero real.
- Salas privadas online de 2–4 jugadores, cooperativo y versus. Cada entrenador elige un Pokémon desbloqueado y su variante normal/shiny.
- Cooperativo: mismo mundo, enemigos y jefes; experiencia compartida; mejoras y evoluciones individuales; pausas compartidas; portales y arenas legendarias en equipo; reanimación al estar cinco segundos cerca de un compañero caído; continuación conjunta al modo sin fin decidida por el anfitrión. Se usan mejoras permanentes iguales para todos y la mochila individual no se consume.
- Versus: último entrenador en pie, ataques automáticos y especial, mejoras y evoluciones por experiencia temporal, arena que se encoge y desenlace forzado después de tres minutos. Las megaevoluciones requieren piedras obtenidas en cooperativo/solo; versus no genera piedras. Tras un minuto de combate, participar da un ticket y ganar otros dos.
- Guardado local y campos de sincronización añadidos a la API original. Los modos de amigos no envían partidas al ranking individual original.

## Ejecutar

Node.js 24 o posterior:

```sh
npm ci
npm run dev -- --host 0.0.0.0
# Otra terminal:
npm run multiplayer
```

Abrir el juego en la dirección de Vite. En «Play with friends», el servidor local es `ws://localhost:8787/rooms` (desde otro dispositivo de la misma red: `ws://IP_DEL_EQUIPO:8787/rooms`). Crear sala, compartir el código, elegir «Ready» en todos los dispositivos y comenzar desde el anfitrión. Un cambio de integrantes reinicia el estado «Ready» para que todos carguen el mismo equipo.

El enlace de invitación contiene solamente el código; cada dispositivo usa el servidor configurado para el sitio o el escrito en el lobby. Esto evita que un enlace externo reconfigure automáticamente el servidor del jugador.

## Publicar para amigos por Internet

GitHub almacena el código. El modo online requiere además un proceso Node con WebSockets. Este servidor puede servir también el juego compilado:

```sh
npm run build
npm run multiplayer
```

Abrir `http://localhost:8787`. Configurar `VITE_SITE_URL` con la URL pública antes de compilar para generar los metadatos del nuevo sitio. Para Internet, desplegar el Dockerfile en un servidor que admita conexiones persistentes, habilitar HTTPS y proxy WebSocket en `/rooms`, y configurar `ROOM_ORIGINS=https://tu-dominio.example` (varios dominios separados por coma). `/health` comprueba que el proceso responde. `PORT` predeterminado: 8787. En un despliegue separado de frontend y relay, usar `VITE_ROOM_URL=wss://servidor.example/rooms` antes de compilar, o escribirlo en el lobby.

Sin `VITE_CLERK_PUBLISHABLE_KEY`/`VITE_API_URL`, se juega como invitado y se conserva el progreso local. Para cuentas y guardados en nube, desplegar también la API original según `server/README.md`; no se reutilizan servicios ni credenciales del autor original.

## Límites de esta versión

El relay ordena las entradas y cada navegador simula el mundo. Es para partidas privadas entre amigos: no sustituye un servidor que valide la simulación ni ofrece protección contra clientes modificados. Compara checksums periódicamente y cierra la sala ante divergencia. Rechaza versiones distintas, limita mensajes y conexiones y limpia salas inactivas. Una desconexión o un cliente muy atrasado termina la sesión; no hay reconexión ni entrada con una partida iniciada. El anfitrión puede abandonar, pero no transferir una partida activa.

Guardados de dispositivos que jugaron sin conexión se combinan con contadores máximos y unión de la colección, como el sistema original. No son un monedero transaccional: un futuro sistema competitivo o de intercambios necesitará inventario y tickets validados en servidor.

## Próximas mejoras propuestas

1. Servidor que simule la partida y gestione inventarios, con reconexión y recuperación de sesión.
2. Evoluciones y estadísticas propias para las especies añadidas; ampliar recursos hacia la Pokédex nacional completa.
3. Rondas de versus, equipos 2 contra 2, reglas de selección y balance por especie.
4. Amigos, invitaciones desde la cuenta, historial cooperativo y objetivos de equipo.
5. Misiones que otorguen tickets ×10, banners de eventos y un historial del gacha con probabilidades efectivas por región.
6. Traducción completa al español y navegación de los nuevos menús con mando.

Se mantienen `LICENSE` y `CREDITS.md`: el código original es MIT y los recursos tienen sus propias licencias y atribuciones.
