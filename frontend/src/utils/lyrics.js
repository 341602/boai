export function parseLyric(rawLyric = '') {
  const normalized = rawLyric.trim()

  if (!normalized) {
    return []
  }

  const parsedLines = []

  normalized.split(/\r?\n/).forEach((line, lineIndex) => {
    const matches = [...line.matchAll(/\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?]/g)]
    const text = line.replace(/\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?]/g, '').trim()

    if (!matches.length) {
      if (text) {
        parsedLines.push({
          id: `plain-${lineIndex}`,
          time: lineIndex * 5,
          text,
        })
      }
      return
    }

    matches.forEach((match, timeIndex) => {
      const minute = Number(match[1] || 0)
      const second = Number(match[2] || 0)
      const millisecond = Number((match[3] || '0').padEnd(3, '0'))

      parsedLines.push({
        id: `${minute}-${second}-${millisecond}-${lineIndex}-${timeIndex}`,
        time: minute * 60 + second + millisecond / 1000,
        text: text || '...',
      })
    })
  })

  return parsedLines.sort((a, b) => a.time - b.time)
}

export function findActiveLyricIndex(lines = [], currentTime = 0) {
  if (!lines.length) {
    return 0
  }

  let activeIndex = 0

  for (let index = 0; index < lines.length; index += 1) {
    if (currentTime >= lines[index].time) {
      activeIndex = index
    } else {
      break
    }
  }

  return activeIndex
}

export function formatTime(value = 0) {
  if (!Number.isFinite(value) || value < 0) {
    return '00:00'
  }

  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
