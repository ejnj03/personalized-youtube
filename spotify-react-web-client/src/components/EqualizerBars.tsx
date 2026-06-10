import { FC } from 'react';
import './EqualizerBars.scss';

interface Props {
  size?: number;
  playing?: boolean;
}

export const EqualizerBars: FC<Props> = ({ size = 10, playing = true }) => {
  return (
    <svg
      className={`equalizer-bars ${playing ? 'is-playing' : 'is-paused'}`}
      viewBox='0 0 16 16'
      width={size}
      height={size}
      aria-hidden='true'
    >
      <rect className='eq-bar eq-bar--1' x='1' y='2' width='3' height='12' rx='0.5' />
      <rect className='eq-bar eq-bar--2' x='6.5' y='2' width='3' height='12' rx='0.5' />
      <rect className='eq-bar eq-bar--3' x='12' y='2' width='3' height='12' rx='0.5' />
    </svg>
  );
};
