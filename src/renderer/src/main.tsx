import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AmbienteProvider } from './ambiente'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AmbienteProvider valor={{ tipo: 'app', download: null, urlRepositorio: '' }}>
      <App />
    </AmbienteProvider>
  </StrictMode>
)
