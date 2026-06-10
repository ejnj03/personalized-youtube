// Components
import { Row } from 'antd';
import { HomeHeader } from './header';
import { HomeAllMusicSection } from './sections/AllMusicSection';
import { HomePodcastSection } from './sections/PodcastSection';
import { CuratedRow } from './sections/CuratedRow';
import { useConfig } from '@showcase/sdk';
import type { SpotifyTheme } from '../../../personalization/host';

// Utils
import { FC, memo, RefObject, useRef } from 'react';
import useIsMobile from '../../../utils/isMobile';

// Store
import { useAppSelector } from '../../../store/store';

interface HomePageContainerProps {
  container: RefObject<HTMLDivElement | null>;
}

const PODCAST_PAGE_COLOR = '#2f2c2a';

const HomePageContainer: FC<HomePageContainerProps> = memo((props) => {
  const { container } = props;
  const config = useConfig();
  const theme = config.theme as SpotifyTheme;
  // Cross-workspace Zod inference sometimes widens `theme.tokens` to unknown
  // in CRA's strict tsc run even when the SDK's d.ts declares the proper
  // shape. Narrowing here keeps webpack happy without losing intent.
  const tokens = theme.tokens as Record<string, string>;
  const backgroundColor = tokens.bg ?? 'rgb(66, 32, 35)';
  // Home page only: SDK theme always wins. Other pages (Album, Playlist,
  // User profile) keep colorthief active via their own setColor wiring —
  // the "page tints with cover art" feature stays where the dominant
  // content is a single piece of art (album/playlist), not a grid feed.
  const accent = tokens.accent ?? 'rgb(64, 244, 36)';

  const isMobile = useIsMobile();
  const sectionContainerRef = useRef<HTMLDivElement>(null);
  const user = useAppSelector((state) => !!state.auth.user);
  const section = useAppSelector((state) => state.home.section);

  //const pageColor = section === 'PODCAST' ? PODCAST_PAGE_COLOR : color;

  return (
    <div ref={sectionContainerRef}>
      <HomeHeader color={accent} container={container} sectionContainer={sectionContainerRef} />
      <div
        className={`Home-seccion${section === 'PODCAST' ? ' Home-seccion--podcasts' : ''}`}
        style={{
          paddingTop: isMobile ? 50 : 0,
          transition: section === 'PODCAST' ? undefined : 'background 5s',
          background: `linear-gradient(180deg, ${accent} 2%, ${backgroundColor} 11%)`,
        }}
      >
        <Row gutter={user ? [16, 8] : undefined}>
          {section === 'PODCAST' ? (
            <HomePodcastSection />
          ) : (
            // setColor stubbed — colorthief disabled on the home page in
            // favor of the SDK theme. Album/Playlist/User pages keep their
            // own colorthief wiring intact.
            <>
              {/* Config-driven, schedule-aware curated row (SDK SourceRules). */}
              <CuratedRow />
              <HomeAllMusicSection setColor={() => {}} />
            </>
          )}
        </Row>
      </div>
    </div>
  );
});

export default HomePageContainer;
