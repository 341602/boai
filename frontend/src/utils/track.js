import { TEXTS } from '../constants/texts'

export function formatArtists(song) {
  return (song?.artists || []).map((artist) => artist.name).join(' / ') || TEXTS.unknownArtist
}

export function formatAlbum(song) {
  return song?.album?.name || TEXTS.unknownAlbum
}

export function getTrackInitial(song) {
  return (song?.name || 'M').trim().slice(0, 1).toUpperCase()
}
