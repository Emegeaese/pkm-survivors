import { locale } from './index'

const en = {
  spectating: 'Watching', previousPlayer: 'Previous player (Q)', nextPlayer: 'Next player (E)', skipAnimation: 'Skip animation',
  collection: 'Pokémon collection', search: 'Search name or Pokédex number', all: 'All', owned: 'Owned', locked: 'Unlock in the ticket gacha', play: 'Play', back: 'Back', shiny: 'Shiny', normal: 'Normal',
  gacha: 'Ticket gacha', friends: 'Play with friends', tickets: 'Tickets', bundles: '×10 tickets', pull: 'Draw ×1', ten: 'Draw ×10', bundle: 'Use ×10 ticket', new: 'NEW',
  gachaInfo: 'Earn 1 ticket every 2 minutes, 2 per boss and 5 for victory. Your first 10 tickets are free. Repeats give Poké Dollars. Shiny: 1% when shiny art exists.',
  guarantee: 'At least 4★ in ×10. A 5★ by draw 70 per region. Regions without legendary art feature their strongest available species as 5★. Rates are conditioned on available rarities.',
  pity: 'Draws since 5★', odds: 'Base odds: 1★ 45% · 2★ 30% · 3★ 17% · 4★ 6.5% · 5★ 1.5%',
  coop: 'Cooperative', versus: 'Versus', create: 'Create room', join: 'Join room', code: 'Room code', name: 'Trainer name', server: 'Room server URL', ready: 'Ready', start: 'Start match',
  lobbyInfo: 'Private rooms for 2–4 trainers. Cooperate against the horde or battle until one trainer remains. Versus uses equal upgrades and a 3-minute shrinking arena.',
  loading: 'Loading the team…', waiting: 'Waiting for everyone to be ready…', connected: 'Connected', disconnected: 'Connection lost. Return to the lobby to join a new match.', error: 'Could not connect. Try again.',
  leave: 'Leave room', revive: 'Stay close to a fallen teammate for 5 seconds to revive them.', down: 'Fainted', winner: 'Winner', draw: 'Draw', teamWin: 'Team victory!', defeat: 'Team defeated',
  results: 'Match results', again: 'Return to menu', pause: 'Pause team', resume: 'Resume team', paused: 'Team paused', choose: 'Choose an upgrade', reward: 'Tickets earned',
  serverHint: 'Sign in with email to play online.',
  unavailable: 'That room is unavailable, full, already playing or running another game version.', copy: 'Copy invite', copied: 'Invite copied', connecting: 'Connecting…', rematch: 'Play again',
}
const pt: typeof en = {
  spectating: 'Assistindo', previousPlayer: 'Jogador anterior (Q)', nextPlayer: 'Próximo jogador (E)', skipAnimation: 'Pular animação',
  collection: 'Coleção Pokémon', search: 'Buscar nome ou número da Pokédex', all: 'Todos', owned: 'Seus Pokémon', locked: 'Desbloqueie no gacha de tickets', play: 'Jogar', back: 'Voltar', shiny: 'Brilhante', normal: 'Normal',
  gacha: 'Gacha de tickets', friends: 'Jogar com amigos', tickets: 'Tickets', bundles: 'Tickets ×10', pull: 'Sortear ×1', ten: 'Sortear ×10', bundle: 'Usar ticket ×10', new: 'NOVO',
  gachaInfo: 'Ganhe 1 ticket a cada 2 minutos, 2 por chefe e 5 por vitória. Os primeiros 10 são grátis. Repetidos rendem Poké Dólares. Brilhante: 1% quando há arte.',
  guarantee: 'Ao menos 4★ em ×10. Um 5★ até o sorteio 70 por região. Regiões sem arte lendária destacam suas espécies mais fortes como 5★. Chances ajustadas às raridades disponíveis.',
  pity: 'Sorteios desde 5★', odds: 'Chances base: 1★ 45% · 2★ 30% · 3★ 17% · 4★ 6,5% · 5★ 1,5%',
  coop: 'Cooperativo', versus: 'Versus', create: 'Criar sala', join: 'Entrar na sala', code: 'Código da sala', name: 'Nome do treinador', server: 'URL do servidor de salas', ready: 'Pronto', start: 'Iniciar partida',
  lobbyInfo: 'Salas privadas para 2–4 treinadores. Enfrentem a horda juntos ou lutem até restar um treinador. Versus tem melhorias iguais e arena que encolhe em 3 minutos.',
  loading: 'Carregando a equipe…', waiting: 'Aguardando todos ficarem prontos…', connected: 'Conectado', disconnected: 'Conexão perdida. Volte ao lobby para entrar em uma nova partida.', error: 'Não foi possível conectar. Tente novamente.',
  leave: 'Sair da sala', revive: 'Fique perto de um aliado caído por 5 segundos para revivê-lo.', down: 'Desmaiou', winner: 'Vencedor', draw: 'Empate', teamWin: 'Vitória da equipe!', defeat: 'Equipe derrotada',
  results: 'Resultado da partida', again: 'Voltar ao menu', pause: 'Pausar equipe', resume: 'Continuar equipe', paused: 'Equipe em pausa', choose: 'Escolha uma melhoria', reward: 'Tickets ganhos',
  serverHint: 'Entre com e-mail para jogar online.',
  unavailable: 'Sala indisponível, cheia, em partida ou em outra versão do jogo.', copy: 'Copiar convite', copied: 'Convite copiado', connecting: 'Conectando…', rematch: 'Jogar de novo',
}
const es: typeof en = {
  spectating: 'Viendo a', previousPlayer: 'Compañero anterior (Q)', nextPlayer: 'Siguiente compañero (E)', skipAnimation: 'Omitir animación',
  collection: 'Colección Pokémon', search: 'Buscar nombre o número de Pokédex', all: 'Todos', owned: 'Desbloqueados', locked: 'Desbloquear en el gacha', play: 'Jugar', back: 'Volver', shiny: 'Variocolor', normal: 'Normal',
  gacha: 'Gacha de tickets', friends: 'Jugar con amigos', tickets: 'Tickets', bundles: 'Tickets ×10', pull: 'Tirada ×1', ten: 'Tirada ×10', bundle: 'Usar ticket ×10', new: 'NUEVO',
  gachaInfo: 'Gana 1 ticket cada 2 minutos, 2 por jefe y 5 por victoria. Empiezas con 10 tickets gratis. Los repetidos dan Pokédólares. Variocolor: 1% cuando hay recursos disponibles.',
  guarantee: 'Al menos un 4★ en ×10. Un 5★ como máximo en la tirada 70 de cada región. Las regiones sin legendarios destacan sus especies más fuertes como 5★. Las probabilidades se ajustan a las rarezas disponibles.',
  pity: 'Tiradas desde el último 5★', odds: 'Probabilidades base: 1★ 45% · 2★ 30% · 3★ 17% · 4★ 6,5% · 5★ 1,5%',
  coop: 'Cooperativo', versus: 'Versus', create: 'Crear sala', join: 'Entrar en sala', code: 'Código de sala', name: 'Nombre de entrenador', server: 'Servidor de salas', ready: 'Listo', start: 'Comenzar partida',
  lobbyInfo: 'Salas privadas para 2–4 entrenadores. Enfrenten juntos a la horda o combatan hasta que quede un ganador. Versus usa mejoras iguales y una arena que se encoge durante 3 minutos.',
  loading: 'Cargando al equipo…', waiting: 'Esperando a los demás jugadores…', connected: 'Conectado', disconnected: 'Se perdió la conexión. Vuelve al menú para crear o entrar en otra sala.', error: 'No se pudo conectar. Inténtalo de nuevo.',
  leave: 'Salir de la sala', revive: 'Quédate junto a un compañero caído durante 5 segundos para reanimarlo.', down: 'Debilitado', winner: 'Ganador', draw: 'Empate', teamWin: '¡Victoria del equipo!', defeat: 'Equipo derrotado',
  results: 'Resultado de la partida', again: 'Volver al menú', pause: 'Pausar equipo', resume: 'Continuar equipo', paused: 'Equipo en pausa', choose: 'Elige una mejora', reward: 'Tickets obtenidos',
  serverHint: 'Inicia sesión con tu correo para jugar con amigos.',
  unavailable: 'Sala no disponible, llena, en partida o con otra versión del juego.', copy: 'Copiar invitación', copied: 'Invitación copiada', connecting: 'Conectando…', rematch: 'Volver a jugar',
}
export const featureText = () => locale() === 'es' ? es : locale() === 'pt' ? pt : en
