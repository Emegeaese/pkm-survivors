# Próxima sesión: mejoras solicitadas el 16 de octubre de 2026

Lista solicitada para la siguiente sesión y comenzada el 16 de octubre de 2026 por indicación del usuario. No hay una ejecución automática programada.

Estado del 16 de octubre: implementados amigos, estadísticas multijugador públicas, intercambios transaccionales con animación, ruleta, misiones con tickets, logros multijugador, mejoras del ranking, cámara de espectador, círculo de reanimación, corrección del PC y primer ajuste de economía/rendimiento. Consulta `ADAPTACION.md` para detalles, mediciones y límites. El balance y la latencia en las conexiones reales de los jugadores deben seguir evaluándose con partidas; no se garantiza un máximo de monedas ni ausencia total de lag.

Referencia para las funciones sociales: [Emegeaese/poke-survivors](https://github.com/Emegeaese/poke-survivors). Revisar su implementación antes de adaptar el comportamiento a este juego y a sus datos de Firebase.

## 1. Bloqueos y fallos de pantalla

- Reproducir y corregir el bloqueo al abrir la caja del PC (`src/ui/pcBox.ts`). Verificar apertura, selección, cierre y reapertura, con colección vacía y grande, y durante los flujos que permitan abrirla. Comprobar que se recuperan los controles y el estado de pausa.
- Revisar pantallas y modales en escritorio y móvil: desbordamientos, elementos superpuestos, botones inaccesibles, escalado y cambios de orientación. Registrar los fallos reproducidos y verificar cada corrección.
- Al morir, permitir observar a los compañeros que sigan vivos y cambiar entre ellos. Cambiar automáticamente de objetivo si el compañero observado muere; recuperar la cámara y los controles propios al revivir. Comprobar el caso en que no queda nadie vivo y respetar las reglas de cada modo.
- Mostrar sobre el compañero caído un círculo que se rellene durante la reanimación, siguiendo el estilo del indicador de los cofres. Sincronizar el progreso visible con la reanimación real y reflejar sus interrupciones y finalización para los jugadores implicados.

## 2. Rendimiento de partidas con amigos

- Medir latencia, frecuencia de mensajes y tiempos de simulación con 2–4 jugadores en cooperativo y versus, tanto por WebRTC como por retransmisión de Firebase.
- Identificar si el lag proviene de red, espera de entradas, simulación o renderizado antes de modificar el transporte. Conservar Firebase para cuentas, salas y señalización.
- Reducir tráfico y trabajo innecesarios donde las mediciones lo justifiquen; verificar que las mejoras mantienen la sincronización, las pausas, las reanimaciones y los resultados.
- Comparar las mediciones antes y después y documentar las limitaciones pendientes.

## 3. Amigos, estadísticas e intercambios

- Adaptar las funciones de amigos de la versión de referencia: añadir amigos, gestionar solicitudes y consultar la lista.
- Permitir abrir el perfil de un amigo y ver sus estadísticas públicas, incluyendo solitario, cooperativo y versus cuando existan datos.
- Añadir intercambio de Pokémon entre amigos con una oferta clara y confirmación de ambos. Mantener los atributos del Pokémon, incluida su condición shiny.
- Incluir una animación del intercambio que muestre los Pokémon enviados y recibidos por ambos jugadores. Mostrar el éxito únicamente cuando la transferencia esté confirmada; evitar que cerrar o repetir la animación vuelva a ejecutar el intercambio y permitir recuperar el resultado tras reconectar.
- Resolver inventario y transferencia de forma atómica y validada en el servidor. Evitar duplicación, pérdida, doble aceptación y entrega parcial ante desconexiones. Revisar primero la representación actual de la colección y los guardados para no basar intercambios en la combinación offline por máximos.
- Aplicar reglas de Firebase y pruebas de permisos para que cada usuario controle únicamente sus solicitudes, ofertas y datos permitidos.

## 4. Gacha y tickets por jugar

- Incorporar una ruleta visual al gacha, con resultado persistente y opción de omitir la animación. La animación debe mostrar el resultado de la tirada sin alterar sus probabilidades.
- Mostrar claramente las probabilidades, coste, garantía y premio, incluida la variante shiny.
- Revisar las recompensas por jugar: ya existen tickets por tiempo, jefes y victoria en solitario/cooperativo, y participación/victoria en versus. Comprobar que se entregan y se muestran correctamente, y ajustar lo necesario para cubrir lo solicitado sin duplicar premios.
- Evitar cobrar o premiar dos veces al pulsar repetidamente, cerrar una pantalla o reconectar.

## 5. Misiones y logros multijugador

- Añadir misiones específicas de cooperativo y versus que otorguen tickets, con progreso y condiciones visibles.
- Añadir logros de ambos modos. Posibles objetivos a ajustar: victorias, partidas completadas, reanimaciones cooperativas y participación en versus.
- Definir el progreso individual y de equipo; comprobar reintentos, desconexiones y reclamación única de recompensas.

## 6. Ranking

- Mejorar la lectura de las clasificaciones de solitario, cooperativo y versus: posición propia, nombres y equipos claros, filtros comprensibles y estados de carga, vacío y error.
- Revisar empates, duplicados y actualización de resultados. Facilitar la consulta de estadísticas del jugador desde las filas cuando corresponda.
- Mantener las separaciones existentes por dificultad, tamaño del equipo y periodo. Documentar los límites de validación de resultados calculados en el cliente.

## 7. Economía y tienda

- Investigar el caso reportado de obtener aproximadamente 20 000 monedas en una partida: identificar fuentes, multiplicadores, duración, modo y posibles premios duplicados.
- Rebalancear ingresos y precios en conjunto según duración, dificultad y modo, conservando la utilidad de las mejoras y evitando progresión trivial o excesivamente lenta.
- Verificar que cooperativo y versus no multiplican indebidamente los ingresos de un jugador y que una reconexión no repite recompensas.
- Documentar los valores anteriores y nuevos y probar partidas representativas antes de publicar.

## Validación y entrega

- Ejecutar las comprobaciones de tipos, pruebas relevantes, integración de Firebase y compilación.
- Probar los flujos sociales y de juego con cuentas distintas, y comprobar las reglas de acceso antes de publicar cambios de Firebase.
- Publicar en `Emegeaese/pkm-survivors` y en el sitio existente una vez verificados los cambios; informar de lo completado, las pruebas y cualquier limitación real.
