export function workoutDate(value: string | null, long = false) {
  return value
    ? new Date(value).toLocaleDateString(undefined, {
        year: 'numeric',
        month: long ? 'long' : 'short',
        day: 'numeric',
      })
    : 'Date unavailable';
}
export function workoutDuration(seconds: number) {
  return seconds < 60 ? `${seconds} sec` : `${Math.floor(seconds / 60)} min`;
}
