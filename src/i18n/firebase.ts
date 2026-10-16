import { locale } from './index'

const es = {
  email: 'Correo electrónico', password: 'Contraseña', name: 'Nombre de entrenador', login: 'Iniciar sesión', register: 'Crear cuenta', reset: 'Olvidé mi contraseña', resetSent: 'Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña.',
  loginInfo: 'Entra con tu correo y contraseña. Tu cuenta Firebase anterior también sirve.', registerInfo: 'Crea tu cuenta con correo y una contraseña de al menos seis caracteres.',
  error: 'No se pudo conectar con Firebase. Inténtalo de nuevo.', invalid: 'Revisa el correo y la contraseña.', exists: 'Ese correo ya tiene una cuenta. Inicia sesión o restablece la contraseña.', weak: 'La contraseña debe tener al menos seis caracteres.', disabled: 'Activa el acceso por correo y contraseña en Firebase Authentication.', rules: 'No se pudo acceder a la base de datos. Revisa las reglas de Firebase.', loginRequired: 'Inicia sesión con tu correo para jugar online y guardar tus resultados.',
  firebase: 'Salas conectadas con Firebase. No necesitas escribir una dirección de servidor.', catalogue: 'Todos los Pokémon', solo: 'Solitario', coop: 'Cooperativo', versus: 'Versus', teams: 'Jugadores por equipo', wins: 'Victorias', info: 'Las clasificaciones del día y la semana usan la hora de Ciudad de México. Cada equipo comparte su mejor marca.',
  initial: 'Los 27 Pokémon iniciales están disponibles desde el principio. Los demás se desbloquean con huevos o en el gacha.',
}
const en: typeof es = {
  email: 'Email address', password: 'Password', name: 'Trainer name', login: 'Sign in', register: 'Create account', reset: 'Forgot password', resetSent: 'If that email has an account, a password reset link will arrive shortly.',
  loginInfo: 'Sign in with email and password. Your previous Firebase account works here too.', registerInfo: 'Create an account with email and a password of at least six characters.',
  error: 'Could not connect to Firebase. Try again.', invalid: 'Check your email and password.', exists: 'That email already has an account. Sign in or reset the password.', weak: 'Use a password of at least six characters.', disabled: 'Enable email/password sign-in in Firebase Authentication.', rules: 'Could not access the database. Check Firebase rules.', loginRequired: 'Sign in with email to play online and save your scores.',
  firebase: 'Rooms use Firebase. No server URL is needed.', catalogue: 'All Pokémon', solo: 'Solo', coop: 'Cooperative', versus: 'Versus', teams: 'Team size', wins: 'Wins', info: 'Daily and weekly boards use Mexico City time. Each team shares its best record.',
  initial: 'All 27 starters are available from the beginning. Unlock the others with eggs or ticket gacha.',
}
const pt: typeof es = { ...en, email: 'E-mail', password: 'Senha', name: 'Nome do treinador', login: 'Entrar', register: 'Criar conta', reset: 'Esqueci a senha', firebase: 'As salas usam Firebase. Não é preciso informar um servidor.', catalogue: 'Todos os Pokémon', solo: 'Solo', coop: 'Cooperativo', versus: 'Versus', teams: 'Tamanho da equipe', wins: 'Vitórias' }
export const firebaseText = () => locale() === 'es' ? es : locale() === 'pt' ? pt : en
