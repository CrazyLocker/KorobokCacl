import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App as AntdApp, ConfigProvider } from 'antd'
import ruRU from 'antd/locale/ru_RU'
import 'antd/dist/reset.css'
import './index.css'
import App from './App.tsx'
import { antdTheme } from './antdTheme'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={ruRU} theme={antdTheme}>
      {/* component={false} сохраняет MUI-разметку до завершения миграции,
          но даёт message/notification/Modal доступ к теме и локали. */}
      <AntdApp component={false}>
        <App />
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
)
