import { html } from '../html'
import { layout } from '../layout'
import { PLAYABLE_IDS } from '../../data/hatchlings'
import { PITY, SHINY_CHANCE } from '../../game/gacha'

/** Spanish guide includes the Firebase modes and progression of this adaptation. */
export const guideEs = () => layout({ id: 'guide', locale: 'es', title: 'Cómo jugar a PKM Survivors', description: 'Controles, gacha, huevos, cuentas, cooperativo, versus y clasificaciones.' }, html`
  <div class="page-head"><h1>Cómo jugar</h1><p class="lead">Elige a tu compañero, esquiva a la horda y construye tu combinación de movimientos.</p></div>
  <div class="doc-body narrow">
    <section class="box doc-section"><h2>Controles</h2>
      <table><thead><tr><th>Acción</th><th>Teclado</th><th>Móvil</th></tr></thead><tbody>
        <tr><td>Moverse</td><td>WASD o flechas</td><td>Arrastra el dedo por la pantalla</td></tr>
        <tr><td>Ataque especial</td><td>Espacio</td><td>Botón redondo de la derecha</td></tr>
        <tr><td>Embestida, si tu Pokémon la tiene</td><td>Shift</td><td>Botón junto al especial</td></tr>
        <tr><td>Megaevolución, con la piedra y evolución final</td><td>E</td><td>Botón MEGA</td></tr>
        <tr><td>Pausar</td><td>Esc o P en solitario; Esc en cooperativo</td><td>Botón de pausa</td></tr>
        <tr><td>Elegir una mejora</td><td>1–3 o flechas e Intro</td><td>Toca la opción</td></tr>
      </tbody></table>
      <p>Los movimientos normales se lanzan automáticamente. En los menús usa las flechas e Intro; Esc vuelve. Elige Español en el selector de idioma o en Ajustes.</p>
    </section>
    <section class="box doc-section"><h2>Tu primera partida</h2>
      <p>Los 27 iniciales de Kanto a Paldea están disponibles desde el principio. En la selección puedes consultar estadísticas, evoluciones, movimientos y especial. «Todos los Pokémon» abre el catálogo completo de ${PLAYABLE_IDS.length} opciones jugables.</p>
      <p>Recoge los caramelos de experiencia que dejan los rivales. Cada subida de nivel ofrece movimientos y objetos. Al alcanzar los niveles de evolución, tu Pokémon evoluciona y mejora sus estadísticas.</p>
      <p>Sobrevive quince minutos y derrota a Mewtwo. Después puedes continuar en el modo sin fin, donde Arceus aparece a los veinte minutos. Normal, Difícil y Pesadilla están disponibles desde el principio.</p>
      <p>Un movimiento al nivel máximo y su objeto compatible permiten evolucionarlo. Por ejemplo, Ember con Charcoal se convierte en Flamethrower. Las Poké Balls de jefes y variocolor también conceden mejoras.</p>
    </section>
    <section class="box doc-section"><h2>Tickets, gacha y variocolor</h2>
      <p>Empiezas con diez tickets. En solitario y cooperativo ganas uno cada dos minutos, dos por jefe y cinco por victoria. Los tickets son del juego y no se compran con dinero real.</p>
      <p>El gacha tiene nueve regiones y tiradas individuales o de diez. Una tirada de diez garantiza al menos un 4★, y cada región garantiza un 5★ como máximo en la tirada ${PITY}. La pantalla muestra el contador y las probabilidades.</p>
      <p>Los Pokémon obtenidos quedan desbloqueados y se eligen en «Todos los Pokémon». Los repetidos conceden monedas. La probabilidad base de variocolor es ${SHINY_CHANCE * 100}% cuando existe su recurso gráfico; al conseguirlo puedes elegir esa variante para jugar.</p>
    </section>
    <section class="box doc-section"><h2>Huevos e incubadora</h2>
      <p>Los jefes, cofres cerrados y portales pueden dejar huevos. La incubadora tiene tres espacios. Los pasos de tus partidas hacen avanzar todos los huevos a la vez; al estar listos, puedes eclosionarlos desde la incubadora.</p>
      <p>Los huevos desbloquean familias jugables y también pueden dar variocolor. Los repetidos se convierten en monedas. Encontrarás la incubadora en el menú principal y en la sección HUEVOS de la selección.</p>
    </section>
    <section class="box doc-section"><h2>Partidas con amigos</h2>
      <p>Inicia sesión con correo y contraseña. Tu cuenta anterior del proyecto Firebase también sirve. En «Jugar con amigos» elige Pokémon y modo, crea una sala y comparte el código de seis caracteres. Los demás entran con ese código. Todos deben pulsar «Listo» y el anfitrión comienza.</p>
      <p>El cooperativo admite de dos a cuatro entrenadores: comparten mundo, enemigos y experiencia, con mejoras individuales. Quédate cinco segundos junto a un compañero caído para reanimarlo. Alguien que esté eligiendo mejora detiene el avance del equipo; la pausa también es compartida.</p>
      <p>En versus todos empiezan con mejoras equivalentes. La arena se encoge durante tres minutos y gana el último entrenador en pie. El ganador obtiene tickets adicionales en partidas de al menos un minuto.</p>
      <p>Firebase gestiona las cuentas, salas y conexión. La partida usa conexión directa cuando es posible y retransmisión por Firebase como alternativa. Si sale el anfitrión o se corta una conexión, vuelve al menú para crear otra partida.</p>
    </section>
    <section class="box doc-section"><h2>Clasificaciones y cuentas</h2>
      <p>Hay tablas de Solitario, Cooperativo y Versus para hoy, esta semana y el histórico. Solitario y cooperativo ordenan por tiempo; cooperativo separa equipos de dos, tres y cuatro. Versus cuenta victorias. Las tablas del día y la semana usan la hora de Ciudad de México.</p>
      <p>Las partidas deben empezar con una cuenta conectada para registrar resultados. Si falla el envío, el resultado queda pendiente en ese navegador y se reintenta al recuperar conexión. Las reglas comprueban la cuenta, el formato y el tiempo transcurrido.</p>
      <p>El progreso se guarda localmente y se sincroniza con tu cuenta Firebase. Puedes entrar en otro dispositivo con el mismo correo. «Olvidé mi contraseña» envía un enlace de recuperación. Sin cuenta puedes jugar en solitario y conservar progreso en ese navegador.</p>
    </section>
    <section class="box doc-section"><h2>Explora y mejora</h2>
      <p>Las zonas cambian durante la partida y el clima modifica la fuerza de los tipos. Sal del alcance de los ataques marcados de los jefes. Los portales opcionales llevan a arenas legendarias y pueden conceder piedras de megaevolución.</p>
      <p>Usa las monedas en las mejoras permanentes de la tienda Pokémon. Las misiones diarias, semanales y los logros ofrecen más recompensas. La Pokédex muestra estadísticas del juego, registros de encuentros y variantes capturadas.</p>
      <p><a href="/es/pokedex/">Consultar la Pokédex</a> · <a href="/es/">Jugar ahora</a></p>
    </section>
  </div>`)
