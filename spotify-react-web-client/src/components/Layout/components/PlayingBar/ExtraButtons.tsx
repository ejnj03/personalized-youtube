// Components
import { Col, Row } from 'antd';
import VolumeControls from './Volume';
import { Tooltip } from '../../../Tooltip';
import { FullScreenPlayer } from '../../../FullScreen';
import { FullScreen, useFullScreenHandle } from 'react-full-screen';

// Icons
import {
  DetailsIcon,
  DeviceIcon,
  ExpandIcon,
  ListIcon,
  MicrophoneIcon,
  PhoneIcon,
} from '../../../Icons';
import { FaVideo } from 'react-icons/fa6';

// I18n
import { useTranslation } from 'react-i18next';

// Redux
import { uiActions } from '../../../../store/slices/ui';
import { languageActions } from '../../../../store/slices/language';
import { useAppDispatch, useAppSelector } from '../../../../store/store';
import { useLocation, useNavigate } from 'react-router-dom';

// Track-aware navigation helper: when entering /lyrics or /video, remember
// where we came from so the back-out returns to the right page.
function useViewToggle(path: '/lyrics' | '/video') {
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname === path;
  return {
    active,
    toggle: () => {
      if (active) {
        navigate(-1);
      } else {
        navigate(path);
      }
    },
  };
}

const LyricsButton = () => {
  const { t } = useTranslation(['playingBar']);
  const { active, toggle } = useViewToggle('/lyrics');

  return (
    <Tooltip title={t('Lyrics')}>
      <button
        style={{
          marginLeft: 5,
          marginRight: 5,
          color: active ? 'var(--accent, #1db954)' : undefined,
        }}
        onClick={toggle}
      >
        <MicrophoneIcon />
      </button>
    </Tooltip>
  );
};

const VideoButton = () => {
  const { t } = useTranslation(['playingBar']);
  const { active, toggle } = useViewToggle('/video');

  return (
    <Tooltip title={t('Music video') as string}>
      <button
        style={{
          marginLeft: 5,
          marginRight: 5,
          color: active ? 'var(--accent, #1db954)' : 'var(--muted-fg, #b3b3b3)',
        }}
        onClick={toggle}
      >
        <FaVideo size={16} fill='currentcolor' />
      </button>
    </Tooltip>
  );
};

const DetailsButton = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(['playingBar']);

  const active = useAppSelector((state) => !state.ui.detailsCollapsed);

  return (
    <>
      <Tooltip title={t('Now playing view')}>
        <button
          className={active ? 'active-icon-button tablet-hidden' : 'tablet-hidden'}
          onClick={() => dispatch(uiActions.toggleDetails())}
          style={{
            marginLeft: 5,
            marginRight: 10,
            cursor: 'pointer',
          }}
        >
          <DetailsIcon active={active} />
        </button>
      </Tooltip>
    </>
  );
};

const QueueButton = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(['playingBar']);
  const queueCollapsed = useAppSelector((state) => state.ui.queueCollapsed);
  return (
    <Tooltip title={t('Queue')}>
      <button
        onClick={() => dispatch(uiActions.toggleQueue())}
        className={!queueCollapsed ? 'active-icon-button' : ''}
        style={{
          marginLeft: 10,
          marginRight: 5,
          cursor: queueCollapsed ? 'pointer' : 'not-allowed',
        }}
      >
        <ListIcon active={!queueCollapsed} />
      </button>
    </Tooltip>
  );
};

const ExpandButton = () => {
  const { t } = useTranslation(['playingBar']);

  const handle = useFullScreenHandle();
  const isQueueOpen = useAppSelector((state) => !state.ui.queueCollapsed);

  return (
    <>
      <FullScreen handle={handle}>
        <FullScreenPlayer onExit={handle.exit} />
      </FullScreen>

      <Tooltip title={t('Full Screen')}>
        <button
          className='tablet-hidden'
          onClick={handle.enter}
          style={{
            marginRight: 5,
            cursor: isQueueOpen ? 'pointer' : 'not-allowed',
          }}
        >
          <ExpandIcon />
        </button>
      </Tooltip>
    </>
  );
};

const DeviceButton = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(['playingBar']);
  const isDeviceOpen = useAppSelector((state) => !state.ui.devicesCollapsed);

  const currentDevice = useAppSelector((state) => state.spotify.activeDeviceType);

  return (
    <Tooltip title={t('Connect to a device')}>
      <button
        onClick={() => dispatch(uiActions.toggleDevices())}
        className={isDeviceOpen ? 'active-icon-button' : ''}
        style={{ marginTop: 4, cursor: isDeviceOpen ? 'pointer' : 'not-allowed' }}
      >
        {currentDevice === 'Smartphone' ? (
          <PhoneIcon active={isDeviceOpen} />
        ) : (
          <DeviceIcon active={isDeviceOpen} />
        )}
      </button>
    </Tooltip>
  );
};

const ExtraControlButtons = () => {
  return (
    <div>
      <Row gutter={18} align='middle'>
        <DetailsButton />

        <LyricsButton />

        <VideoButton />

        <QueueButton />

        <Col className='hiddable-icon'>
          <DeviceButton />
        </Col>

        <Col>
          <VolumeControls />
        </Col>

        <Col>
          <ExpandButton />
        </Col>
      </Row>
    </div>
  );
};

export default ExtraControlButtons;
