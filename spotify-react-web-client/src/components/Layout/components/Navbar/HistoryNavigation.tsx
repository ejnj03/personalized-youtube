import { Space } from 'antd';

import NavigationButton from './NavigationButton';
import ForwardBackwardsButton from './ForwardBackwardsButton';

import { useTranslation } from 'react-i18next';
import { memo } from 'react';
import { FaSpotify } from 'react-icons/fa6';
import { useNavigate } from 'react-router-dom';

const HistoryNavigation = memo(() => {
  const { t } = useTranslation(['navbar']);
  const navigate = useNavigate();
  return (
    <Space>
      <NavigationButton
        text={t('Home')}
        onClick={() => navigate('/')}
        icon={<FaSpotify fill='currentcolor' />}
      />

      <div className='flex flex-row items-center gap-2 h-full'>
        <ForwardBackwardsButton flip />
        <ForwardBackwardsButton flip={false} />
      </div>
    </Space>
  );
});

export default HistoryNavigation;
