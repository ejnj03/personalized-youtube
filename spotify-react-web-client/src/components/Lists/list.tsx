import { Flex } from 'antd';
import { Link } from 'react-router-dom';
import { AlbumCard, ArtistCard, PlaylistCard, TrackCard } from './GridCards';
import { ScrollableGridCarousel } from './ScrollableGridCarousel';

// Personalization — on the home page (horizontalScroll), route through
// MediaCollection so visitor prompts can switch between row and grid
// (e.g. "show new releases as one column" / "instagram feed").
import {
  MediaCollection,
  useConfig,
  resolveCardPreset,
  resolveLayoutPreset,
} from '@showcase/sdk';
import { cardPresetCatalog, layoutPresetCatalog } from '../../personalization/schemas';

// Utils
import { useTranslation } from 'react-i18next';

// Interfaces
import type { FC, ReactNode } from 'react';
import type { Track } from '../../interfaces/track';
import type { Album } from '../../interfaces/albums';
import type { Artist } from '../../interfaces/artist';
import type { Playlist } from '../../interfaces/playlists';
import { useAppSelector } from '../../store/store';

type Item = Album | Playlist | Artist | Track;

export function GridItemComponent(props: {
  item: Item;
  onClick?: () => void;
  getDescription?: (item: Item) => string;
}) {
  const { item, getDescription, onClick } = props;

  if (item.type === 'track') {
    return <TrackCard item={item} onClick={onClick} />;
  }

  if (item.type === 'album') {
    return <AlbumCard item={item} onClick={onClick} getDescription={getDescription} />;
  }

  if (item.type === 'playlist') {
    return <PlaylistCard item={item} onClick={onClick} getDescription={getDescription} />;
  }

  if (item.type === 'artist') {
    return <ArtistCard item={item} onClick={onClick} getDescription={getDescription} />;
  }

  return null;
}

export const DeleteButton: FC<{
  onClick: () => void;
}> = (props) => {
  return (
    <div style={{ position: 'absolute', right: 8, top: 8, zIndex: 10 }}>
      <button
        className='item-delete-button'
        aria-label='Remove'
        onClick={(e) => {
          e.stopPropagation();
          props.onClick();
        }}
      >
        <svg data-encore-id='icon' role='img' aria-hidden='true' viewBox='0 0 16 16'>
          <path d='M2.47 2.47a.75.75 0 0 1 1.06 0L8 6.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L9.06 8l4.47 4.47a.75.75 0 1 1-1.06 1.06L8 9.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L6.94 8 2.47 3.53a.75.75 0 0 1 0-1.06Z'></path>
        </svg>
      </button>
    </div>
  );
};

export function GridItemList(props: {
  title?: ReactNode;
  headerClassName?: string;
  items: Item[];
  moreUrl?: string;
  extra?: ReactNode;
  chips?: ReactNode;
  subtitle?: string;
  multipleRows?: boolean;
  horizontalScroll?: boolean;
  headerActionsAlign?: 'center' | 'bottom';
  onItemClick?: (item: Item) => void;
  onItemDelete?: (item: Item) => void;
  getDescription?: (item: Item) => string;
}) {
  const [t] = useTranslation(['artist']);
  const user = useAppSelector((state) => !!state.auth.user);
  const { onItemDelete, onItemClick, getDescription } = props;
  const { items, chips, title, headerClassName, moreUrl, extra, subtitle, horizontalScroll, headerActionsAlign } =
    props;
  const headerClass = ['playlist-header', headerClassName].filter(Boolean).join(' ');

  // Resolve the theme's card + layout presets — used only on the
  // horizontalScroll path (Home page sections). The non-scroll path still
  // renders into the existing `playlist-grid` SCSS layout.
  const config = useConfig();
  const themeAny = config.theme as Record<string, unknown>;
  const cardPresetResolved = resolveCardPreset(
    cardPresetCatalog,
    (themeAny.cardPreset as string) ?? 'audio_card',
    (themeAny.cardOverrides as Record<string, unknown>) ?? {},
  );
  const layoutPresetResolved = resolveLayoutPreset(
    layoutPresetCatalog,
    (themeAny.layoutPreset as string) ?? 'row_scroll',
  );

  // Items shared by both the MediaCollection path and the legacy grid path.
  // MediaCollection (used when horizontalScroll is true) supplies its own
  // per-item sizing wrapper internally; the legacy `playlist-grid` path
  // doesn't, but each item still gets its own relative wrapper for the
  // delete-overlay positioning.
  const gridItems = (items || []).filter((i) => i).map((item) => (
    <div key={item.uri} style={{ position: 'relative' }}>
      {onItemDelete ? <DeleteButton onClick={() => onItemDelete(item)} /> : null}
      <GridItemComponent
        item={item}
        getDescription={getDescription}
        onClick={onItemClick ? () => onItemClick(item) : undefined}
      />
    </div>
  ));

  const gridContent = horizontalScroll ? (
    <MediaCollection preset={layoutPresetResolved} cardOrientation={cardPresetResolved.orientation}>
      {gridItems}
    </MediaCollection>
  ) : (
    <div
      className='playlist-grid'
      style={
        props.multipleRows
          ? {
              gridTemplateRows: 'unset',
            }
          : undefined
      }
    >
      {gridItems}
    </div>
  );

  return (
    <div className={`${!user ? 'guest' : ''}`}>
      <Flex
        className='grid-item-list-header'
        justify='space-between'
        align={headerActionsAlign === 'bottom' ? 'flex-end' : 'center'}
      >
        <div>
          {title ? (
            moreUrl ? (
              <Link to={moreUrl} style={{ textDecoration: 'none' }}>
                <h1 className={headerClass}>{title}</h1>
              </Link>
            ) : (
              <h1 className={headerClass}>{title}</h1>
            )
          ) : null}

          {subtitle ? <h2 className='playlist-subheader'>{subtitle}</h2> : null}
        </div>

        {extra ? (
          extra
        ) : moreUrl ? (
          <Link to={moreUrl}>
            <button className='showMore'>
              <span>{t('Show more')}</span>
            </button>
          </Link>
        ) : null}
      </Flex>

      {chips}
      {gridContent}
    </div>
  );
}
