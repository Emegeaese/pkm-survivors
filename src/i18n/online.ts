export const onlineGoals = {
  es: {
    coopRuns: (n: string) => `Completa ${n} partidas cooperativas (mínimo 1 min)`,
    coopWins: (n: string) => `Gana ${n} partidas cooperativas`,
    coopMinutes: (n: string) => `Juega ${n} min en cooperativo`,
    coopRevivals: (n: string) => `Reanima a un compañero ${n} veces`,
    versusRuns: (n: string) => `Completa ${n} partidas versus (mínimo 1 min)`,
    versusWins: (n: string) => `Gana ${n} partidas versus (mínimo 1 min)`,
  },
  en: {
    coopRuns: (n: string) => `Complete ${n} cooperative matches (at least 1 min)`,
    coopWins: (n: string) => `Win ${n} cooperative matches`,
    coopMinutes: (n: string) => `Play ${n} min in cooperative mode`,
    coopRevivals: (n: string) => `Revive a teammate ${n} times`,
    versusRuns: (n: string) => `Complete ${n} versus matches (at least 1 min)`,
    versusWins: (n: string) => `Win ${n} versus matches (at least 1 min)`,
  },
  pt: {
    coopRuns: (n: string) => `Complete ${n} partidas cooperativas (mínimo 1 min)`,
    coopWins: (n: string) => `Vença ${n} partidas cooperativas`,
    coopMinutes: (n: string) => `Jogue ${n} min no cooperativo`,
    coopRevivals: (n: string) => `Reviva um aliado ${n} vezes`,
    versusRuns: (n: string) => `Complete ${n} partidas versus (mínimo 1 min)`,
    versusWins: (n: string) => `Vença ${n} partidas versus (mínimo 1 min)`,
  },
}
export const onlineNames = {
  es: { coopFirst: 'Juntos hasta el final', coopChampion: 'Equipo campeón', coopRescuer: 'Siempre a tu lado', versusFirst: 'Primer duelo', versusChampion: 'Rival de élite', versusVeteran: 'Veterano de la arena' },
  en: { coopFirst: 'Together to the end', coopChampion: 'Champion team', coopRescuer: 'By your side', versusFirst: 'First duel', versusChampion: 'Elite rival', versusVeteran: 'Arena veteran' },
  pt: { coopFirst: 'Juntos até o fim', coopChampion: 'Equipe campeã', coopRescuer: 'Ao seu lado', versusFirst: 'Primeiro duelo', versusChampion: 'Rival de elite', versusVeteran: 'Veterano da arena' },
}
