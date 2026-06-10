export const MADE_FOR_YOU_URI = '0JQ5DAt0tbjZptfcdMSKl3';

export const RANKING_URI = '0JQ5DAudkNjCgYMM0TZXDw';

export const TRENDING_URI = '0JQ5DAqbMKFQIL0AXnG5AK';

export const PODCAST_SEARCH_MIGHT_LIKE_QUERY = 'podcast';

export const PODCAST_SEARCH_TO_TRY_QUERY = 'podcast';

export const INITIAL_VOLUME = 0.2;

export const PLAYLIST_DEFAULT_IMAGE = `${process.env.PUBLIC_URL}/images/playlist.png`;

export const ARTISTS_DEFAULT_IMAGE = `${process.env.PUBLIC_URL}/images/artist.png`;

export const LIKED_SONGS_IMAGE = `${process.env.PUBLIC_URL}/images/liked-songs.png`;

export const EQUILISER_IMAGE = `${process.env.PUBLIC_URL}/images/equaliser-animated.gif`;

// The bottom of every page-header gradient (Album, Playlist, User profile,
// LoginModal). `var(--bg)` resolves at paint time to the SDK theme's bg
// token; `#121212` is the fallback when no theme is active (matches the
// original spotify clone behavior).
export const DEFAULT_PAGE_COLOR = 'var(--bg, #121212)';
