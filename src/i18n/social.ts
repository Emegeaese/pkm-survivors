import { locale } from './index'
const es = {
  friends: 'Amigos', handle: 'Apodo del entrenador (@usuario)', add: 'Añadir amigo', sent: 'Solicitud enviada', missing: 'No se encontró ese entrenador o es tu propia cuenta.',
  accept: 'Aceptar', reject: 'Rechazar', cancel: 'Cancelar', remove: 'Quitar amigo', incoming: 'Solicitud recibida', pending: 'Esperando respuesta', empty: 'Aún no tienes amigos ni solicitudes.',
  profile: 'Ver estadísticas', trade: 'Intercambiar Pokémon', back: 'Volver', error: 'No se pudo completar la operación. Comprueba la conexión y vuelve a intentarlo.', loading: 'Cargando…',
  myHandle: 'Tu apodo', send: 'Ofrecer Pokémon', confirm: 'Confirmar intercambio', waiting: 'Esperando la confirmación de tu amigo', done: '¡Intercambio completado!', choose: 'Elige tu Pokémon',
  theirOffer: 'Recibes', myOffer: 'Entregas', noOffer: 'Sin oferta', inventory: 'Copias disponibles del gacha', history: 'Intercambios recientes', cancelled: 'Intercambio cancelado',
  tradeInfo: 'Los intercambios transfieren copias obtenidas en el gacha, incluidas las shiny. Ambos deben confirmar la oferta actual. Las copias se transfieren juntas al completarse.',
  coopRuns: 'Cooperativos completados', coopWins: 'Victorias cooperativas', coopMinutes: 'Minutos en cooperativo', coopRevivals: 'Compañeros reanimados', versusRuns: 'Versus completados', versusWins: 'Victorias versus',
  online: (n: number) => n === 1 ? '1 entrenador en línea' : `${n} entrenadores en línea`, friendsOf: (n: number) => n === 1 ? '1 amigo' : `${n} amigos`, noFriendsYet: 'Aún no tiene amigos.', addFriend: 'Añadir amigo', requested: 'Solicitud enviada',
  background: 'Fondo del perfil', noBackground: 'Sin fondo', searchPokemon: 'Buscar Pokémon…', pickBackground: 'Elige un Pokémon para el fondo de tu perfil.', more: (n: number) => `y ${n} más`,
  onlineStats: 'Cooperativo y versus', matchHistory: 'Historial de partidas', historyRuns: 'Partidas', historyWins: 'Victorias', historyBest: 'Mejor tiempo', historyAverage: 'Tiempo medio', favorites: 'Pokémon favoritos', mostUsed: 'Pokémon más usados',
  titleLabel: 'Título del perfil', noTitle: 'Sin título', titleNote: 'Los títulos se desbloquean con logros y regalos.', photo: 'Foto de perfil', wallpaper: 'Fondo del perfil', favoritesPick: 'Favoritos (hasta 3; sin elegir se muestran los más usados)', clear: 'Quitar', wallpaperNote: 'Los fondos se compran en la tienda Pokémon.', lookNote: 'Solo puedes elegir Pokémon que ya tienes.',
}
const en: typeof es = {
  friends: 'Friends', handle: 'Trainer handle (@username)', add: 'Add friend', sent: 'Request sent', missing: 'Trainer not found, or this is your own account.',
  accept: 'Accept', reject: 'Decline', cancel: 'Cancel', remove: 'Remove friend', incoming: 'Incoming request', pending: 'Awaiting response', empty: 'No friends or requests yet.',
  profile: 'View statistics', trade: 'Trade Pokémon', back: 'Back', error: 'Could not complete this action. Check your connection and try again.', loading: 'Loading…',
  myHandle: 'Your handle', send: 'Offer Pokémon', confirm: 'Confirm trade', waiting: 'Waiting for your friend to confirm', done: 'Trade completed!', choose: 'Choose your Pokémon',
  theirOffer: 'You receive', myOffer: 'You send', noOffer: 'No offer', inventory: 'Available gacha copies', history: 'Recent trades', cancelled: 'Trade cancelled',
  tradeInfo: 'Trade copies obtained from the gacha, including shinies. Both trainers must confirm the current offer. Copies transfer together when the trade completes.',
  coopRuns: 'Co-op matches completed', coopWins: 'Co-op wins', coopMinutes: 'Co-op minutes', coopRevivals: 'Teammates revived', versusRuns: 'Versus matches completed', versusWins: 'Versus wins',
  online: (n: number) => n === 1 ? '1 trainer online' : `${n} trainers online`, friendsOf: (n: number) => n === 1 ? '1 friend' : `${n} friends`, noFriendsYet: 'No friends yet.', addFriend: 'Add friend', requested: 'Request sent',
  background: 'Profile background', noBackground: 'No background', searchPokemon: 'Search Pokémon…', pickBackground: 'Pick a Pokémon for your profile background.', more: (n: number) => `and ${n} more`,
  onlineStats: 'Co-op and versus', matchHistory: 'Match history', historyRuns: 'Matches', historyWins: 'Wins', historyBest: 'Best time', historyAverage: 'Average time', favorites: 'Favorite Pokémon', mostUsed: 'Most used Pokémon',
  titleLabel: 'Profile title', noTitle: 'No title', titleNote: 'Titles unlock with achievements and gifts.', photo: 'Profile photo', wallpaper: 'Profile background', favoritesPick: 'Favorites (up to 3; if none, your most used are shown)', clear: 'Clear', wallpaperNote: 'Backgrounds are bought in the Pokémon Mart.', lookNote: 'You can only pick Pokémon you own.',
}
const pt: typeof es = {
  friends: 'Amigos', handle: 'Apelido do treinador (@usuário)', add: 'Adicionar amigo', sent: 'Pedido enviado', missing: 'Treinador não encontrado ou esta é sua conta.',
  accept: 'Aceitar', reject: 'Recusar', cancel: 'Cancelar', remove: 'Remover amigo', incoming: 'Pedido recebido', pending: 'Aguardando resposta', empty: 'Sem amigos ou pedidos ainda.',
  profile: 'Ver estatísticas', trade: 'Trocar Pokémon', back: 'Voltar', error: 'Não foi possível concluir. Confira a conexão e tente novamente.', loading: 'Carregando…',
  myHandle: 'Seu apelido', send: 'Oferecer Pokémon', confirm: 'Confirmar troca', waiting: 'Aguardando confirmação do seu amigo', done: 'Troca concluída!', choose: 'Escolha seu Pokémon',
  theirOffer: 'Você recebe', myOffer: 'Você entrega', noOffer: 'Sem oferta', inventory: 'Cópias disponíveis do gacha', history: 'Trocas recentes', cancelled: 'Troca cancelada',
  tradeInfo: 'Troque cópias obtidas no gacha, incluindo shiny. Ambos confirmam a oferta atual. As cópias são transferidas juntas ao concluir.',
  coopRuns: 'Cooperativos concluídos', coopWins: 'Vitórias cooperativas', coopMinutes: 'Minutos cooperativos', coopRevivals: 'Aliados revividos', versusRuns: 'Versus concluídos', versusWins: 'Vitórias versus',
  online: (n: number) => n === 1 ? '1 treinador online' : `${n} treinadores online`, friendsOf: (n: number) => n === 1 ? '1 amigo' : `${n} amigos`, noFriendsYet: 'Ainda sem amigos.', addFriend: 'Adicionar amigo', requested: 'Pedido enviado',
  background: 'Fundo do perfil', noBackground: 'Sem fundo', searchPokemon: 'Buscar Pokémon…', pickBackground: 'Escolha um Pokémon para o fundo do perfil.', more: (n: number) => `e mais ${n}`,
  onlineStats: 'Cooperativo e versus', matchHistory: 'Histórico de partidas', historyRuns: 'Partidas', historyWins: 'Vitórias', historyBest: 'Melhor tempo', historyAverage: 'Tempo médio', favorites: 'Pokémon favoritos', mostUsed: 'Pokémon mais usados',
  titleLabel: 'Título do perfil', noTitle: 'Sem título', titleNote: 'Os títulos são desbloqueados com conquistas e presentes.', photo: 'Foto do perfil', wallpaper: 'Fundo do perfil', favoritesPick: 'Favoritos (até 3; sem escolha, mostramos os mais usados)', clear: 'Limpar', wallpaperNote: 'Os fundos são comprados na loja Pokémon.', lookNote: 'Você só pode escolher Pokémon que já tem.',
}
export const socialText = () => locale() === 'es' ? es : locale() === 'pt' ? pt : en
